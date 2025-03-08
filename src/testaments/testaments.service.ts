import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import {
  CreateTestamentDto,
  CreateAssignmentDto,
  UpdateAssignmentDto,
} from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as stream from 'stream';

const s3Client = new S3Client({
  region: process.env.AWSREGION,
});

@Injectable()
export class TestamentsService {
  private prisma: any = null;
  // Validate valid state if provided
  private validStatuses = ['ACTIVE', 'INACTIVE'];

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserTestaments(
    userId: string,
    paginationDto: PaginationDto,
    status?: string,
    version?: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const { page, limit } = paginationDto;
    if (status && !this.validStatuses.includes(status)) {
      response.code = 400;
      response.msg = 'Invalid testament status provided';
      throw new HttpException(response, HttpStatus.BAD_REQUEST);
    }

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Convert page and limit to integers
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;

      // Build dynamic filters
      const whereClause: any = { userId };
      if (status) whereClause.status = status;
      if (version) whereClause.version = version;

      const [testaments, total] = await Promise.all([
        this.prisma.testamentHeader.findMany({
          where: whereClause,
          skip: offset,
          take: limitNumber,
          orderBy: { creationDate: 'desc' },
        }),
        this.prisma.testamentHeader.count({ where: whereClause }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = `No testaments found for the provided ${status ? `status "${status}"` : ''}`;
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Testaments retrieved successfully';
      response.response = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        testaments,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getTestamentById(testamentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const testament = await this.prisma.testamentHeader.findFirst({
        where: { id: testamentId },
        include: { TestamentAssignment: true },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (
        Array.isArray(testament.TestamentAssignment) &&
        testament.TestamentAssignment.length === 0
      ) {
        delete testament.TestamentAssignment;
      }

      response.code = 200;
      response.msg = 'Testament retrieved successfully';
      response.response = testament;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createTestament(
    userId: string,
    createTestamentDto: CreateTestamentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const newTestament = await this.prisma.$transaction(async (tx: any) => {
        // Consultas iniciales en transacción
        const userExists = await tx.user.findUnique({ where: { id: userId } });
        if (!userExists) {
          throw new HttpException(
            { code: 404, msg: 'User not found' },
            HttpStatus.NOT_FOUND,
          );
        }

        const draftTestament = await tx.testamentHeader.findFirst({
          where: { userId, status: 'DRAFT' },
        });
        if (draftTestament) {
          throw new HttpException(
            { code: 400, msg: 'A draft testament already exists.' },
            HttpStatus.BAD_REQUEST,
          );
        }

        const lastVersion = await tx.testamentHeader.findFirst({
          where: { userId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const newVersion = (lastVersion?.version || 0) + 1;

        const activeTestament = await tx.testamentHeader.findFirst({
          where: { userId, status: 'ACTIVE' },
          orderBy: { creationDate: 'desc' },
        });

        let createdTestament;
        if (activeTestament) {
          // Regla 3: Copiar información del testamento activo para crear un borrador
          createdTestament = await tx.testamentHeader.create({
            data: {
              userId,
              version: newVersion,
              status: 'DRAFT',
              terms: createTestamentDto.terms ?? activeTestament.terms,
              legalAdvisor:
                createTestamentDto.legalAdvisor ?? activeTestament.legalAdvisor,
              notes: createTestamentDto.notes ?? activeTestament.notes,
            },
          });

          // Copiar registros de TestamentAssignment
          const activeAssignments = await tx.testamentAssignment.findMany({
            where: { testamentId: activeTestament.id },
          });
          for (const assignment of activeAssignments) {
            await tx.testamentAssignment.create({
              data: {
                testamentId: createdTestament.id,
                assetId: assignment.assetId,
                percentage: assignment.percentage,
                assignmentType: assignment.assignmentType,
                assignmentId: assignment.assignmentId,
                notes: assignment.notes,
              },
            });
          }

          // Copiar registros de Executor
          const activeExecutors = await tx.executor.findMany({
            where: { testamentHeaderId: activeTestament.id },
          });
          for (const executor of activeExecutors) {
            await tx.executor.create({
              data: {
                testamentHeaderId: createdTestament.id,
                type: executor.type,
                contactId: executor.contactId,
              },
            });
          }
        } else {
          // Regla 1: Crear testamento
          createdTestament = await tx.testamentHeader.create({
            data: {
              ...createTestamentDto,
              userId,
              version: newVersion,
              status: 'DRAFT',
            },
          });
        }
        return createdTestament;
      });

      response.code = 201;
      response.msg = 'Testament created successfully';
      response.response = newTestament;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  // async updateTestament(
  //   testamentId: string,
  //   updateTestamentDto: UpdateTestamentDto,
  // ): Promise<GeneralResponseDto> {
  //   const response = new GeneralResponseDto();
  //   try {
  //     this.prisma = await this.prismaProvider.getPrismaClient();
  //     if (!this.prisma) {
  //       console.log('Error-> db-connection-failed');
  //       response.code = 500;
  //       response.msg = 'Could not connect to the database';
  //       throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
  //     }

  //     const testamentExists = await this.prisma.testamentHeader.findUnique({
  //       where: { id: testamentId },
  //     });

  //     if (!testamentExists) {
  //       response.code = 404;
  //       response.msg = 'Testament not found';
  //       throw new HttpException(response, HttpStatus.NOT_FOUND);
  //     }

  //     // Verificar si el status es 'ACTIVE'
  //     if (updateTestamentDto.status === 'ACTIVE') {
  //       // Obtener el userId del testamento a actualizar
  //       const currentTestament = await this.prisma.testamentHeader.findUnique({
  //         where: { id: testamentId },
  //         select: { userId: true },
  //       });

  //       if (!currentTestament) {
  //         response.code = 404;
  //         response.msg = 'Testament not found';
  //         throw new HttpException(response, HttpStatus.NOT_FOUND);
  //       }

  //       // Actualizar todos los testamentos de este usuario a 'INACTIVE'
  //       await this.prisma.testamentHeader.updateMany({
  //         where: {
  //           userId: currentTestament.userId,
  //           status: 'ACTIVE',
  //           id: { not: testamentId }, // Excluir el testamento actual
  //         },
  //         data: { status: 'INACTIVE' },
  //       });
  //     }

  //     const testament = await this.prisma.testamentHeader.update({
  //       where: { id: testamentId },
  //       data: updateTestamentDto,
  //     });

  //     response.code = 200;
  //     response.msg = 'Testament updated successfully';
  //     response.response = testament;
  //     return response;
  //   } catch (error) {
  //     processException(error);
  //   }
  // }

  async deleteTestament(testamentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const testamentExist = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testamentExist) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      await this.prisma.testamentHeader.delete({ where: { id: testamentId } });

      response.code = 200;
      response.msg = 'Testament deleted successfully';
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createAssignment(
    testamentId: string,
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // Validate that the testament exists for the given userId
      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (createAssignmentDto.assetId) {
        const assetExists = await this.prisma.asset.findUnique({
          where: { id: createAssignmentDto.assetId },
        });

        if (!assetExists) {
          response.code = 400;
          response.msg = 'The provided assetId does not exist in the system';
          return response;
        }

        // Validar que el asset pertenezca al mismo usuario que el testamento
        if (assetExists.userId !== testament.userId) {
          response.code = 400;
          response.msg =
            'The provided assetId does not belong to the same user as the testament';
          return response;
        }
      }

      // Validate if the assignmentId exists, if it was provided
      if (createAssignmentDto.assignmentId) {
        // Validate in Contact table
        const contactExists = await this.prisma.contact.findUnique({
          where: { id: createAssignmentDto.assignmentId },
        });

        // If not found in Contact, check in LegalEntity
        if (!contactExists) {
          const legalEntityExists = await this.prisma.legalEntity.findUnique({
            where: { id: createAssignmentDto.assignmentId },
          });

          // If not found in either table, return an error response
          if (!legalEntityExists) {
            response.code = 400;
            response.msg =
              'The provided assignmentId does not exist in the system';
            return response;
          }
        }
      }

      // Retrieve existing assignment percentages for the testament
      const existingAssignments =
        await this.prisma.testamentAssignment.findMany({
          where: {
            testamentId,
            assetId: createAssignmentDto.assetId,
          },
          select: { percentage: true },
        });

      // Add up the existing assignment percentages
      const currentPercentageSum: number = existingAssignments.reduce(
        (sum: number, assignment: { percentage: number }) =>
          sum + assignment.percentage,
        0,
      );

      // Verify that the percentage does not exceed 100%
      if (currentPercentageSum + createAssignmentDto.percentage > 100) {
        response.code = 400;
        response.msg = 'Total percentage for assignments exceeds 100%';
        return response;
      }

      // Create the assignment
      const assignment = await this.prisma.testamentAssignment.create({
        data: { testamentId, ...createAssignmentDto },
      });

      response.code = 201;
      response.msg = 'Assignment created successfully';
      response.response = assignment;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateAssignment(
    assignmentId: string,
    updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      // Validar que la asignación exista
      const existingAssignment =
        await this.prisma.testamentAssignment.findUnique({
          where: { id: assignmentId },
        });

      if (!existingAssignment) {
        response.code = 404;
        response.msg = 'Assignment not found';
        return response;
      }

      // Validar assetId si se modifica
      if (updateAssignmentDto.assetId) {
        const assetExists = await this.prisma.asset.findUnique({
          where: { id: updateAssignmentDto.assetId },
        });
        if (!assetExists) {
          response.code = 400;
          response.msg = 'The provided assetId does not exist';
          return response;
        }
      }

      // 3. Validar assignmentId si se modifica
      if (updateAssignmentDto.assignmentId) {
        let entityExists: boolean;

        // Si el tipo es 'c' (contact), validar en la tabla Contact
        if (updateAssignmentDto.assignmentType === 'c') {
          entityExists = !!(await this.prisma.contact.findUnique({
            where: { id: updateAssignmentDto.assignmentId },
          }));
        } else {
          // Si el tipo es 'le' (legal entity), validar en la tabla LegalEntity
          entityExists = !!(await this.prisma.legalEntity.findUnique({
            where: { id: updateAssignmentDto.assignmentId },
          }));
        }

        if (!entityExists) {
          response.code = 400;
          response.msg = 'assignmentId does not match assignmentType';
          return response;
        }
      }

      // 4. Validar porcentajes acumulados
      const assetIdToCheck =
        updateAssignmentDto.assetId || existingAssignment.assetId;
      const existingAssignments =
        await this.prisma.testamentAssignment.findMany({
          where: {
            assetId: assetIdToCheck,
            id: { not: assignmentId },
          },
          select: { percentage: true },
        });

      const currentPercentageSum = existingAssignments.reduce(
        (sum, assignment) => sum + assignment.percentage,
        0,
      );

      if (
        updateAssignmentDto.percentage !== undefined &&
        currentPercentageSum + updateAssignmentDto.percentage > 100
      ) {
        response.code = 400;
        response.msg = 'Total percentage exceeds 100% for this asset';
        return response;
      }

      // Actualizar
      const updatedAssignment = await this.prisma.testamentAssignment.update({
        where: { id: assignmentId },
        data: updateAssignmentDto,
      });

      response.code = 200;
      response.msg = 'Assignment updated successfully';
      response.response = updatedAssignment;
      return response;
    } catch (error) {
      console.error('Error updating assignment:', error);
      response.code = 500;
      response.msg = 'Error updating assignment';
      return response;
    }
  }

  async deleteAssignment(testamentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      // Obtén la instancia de Prisma
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      // 1. Verifica que el testamento exista
      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        return response;
      }

      // 2. (Opcional) Valida que el testamento esté en estado ACTIVE si tu lógica lo requiere
      /*
      if (testament.status !== 'ACTIVE') {
        response.code = 400;
        response.msg = 'The testament is not active';
        return response;
      }
      */

      // 3. Elimina todas las asignaciones relacionadas con ese testamento
      const deleteResult = await this.prisma.testamentAssignment.deleteMany({
        where: { testamentId },
      });

      response.code = 200;
      response.msg = 'Assignment(s) deleted successfully';
      response.response = {
        deletedCount: deleteResult.count,
      };
      return response;
    } catch (error) {
      console.error('Error deleting assignment(s):', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while deleting the assignment(s)';
      return response;
    }
  }

  async streamTestamentPdf(testamentId: string, res: Response): Promise<void> {
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.error('[streamTestamentPdf] Could not connect to the database');
        res.status(500).json({
          code: 500,
          msg: 'Could not connect to the database',
          response: null,
        });
        return;
      }

      console.log('[streamTestamentPdf] Connected to database.');

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        console.log('[streamTestamentPdf] Testament not found.');
        res.status(404).json({
          code: 404,
          msg: 'Testament not found.',
          response: null,
        });
        return;
      }

      let bucket: string;
      let key: string;

      try {
        if (typeof testament.url === 'object' && testament.url.set) {
          bucket = testament.url.set.bucket;
          key = testament.url.set.key;
        } else {
          throw new Error('Invalid URL format in database.');
        }
      } catch (error) {
        console.error('[streamTestamentPdf] Error parsing URL:', error);
        res.status(500).json({
          code: 500,
          msg: 'Invalid URL data format.',
          response: null,
        });
        return;
      }

      console.log(
        `[streamTestamentPdf] Fetching from S3: Bucket=${bucket}, Key=${key}`,
      );

      try {
        const params = { Bucket: bucket, Key: key };
        const { Body, ContentLength } = await s3Client.send(
          new GetObjectCommand(params),
        );

        console.log(
          `[streamTestamentPdf] S3 Response - ContentLength: ${ContentLength || 'Unknown'}`,
        );

        if (!(Body instanceof stream.Readable)) {
          throw new Error('[streamTestamentPdf] Invalid S3 object stream.');
        }

        // Convertir el ReadableStream en Buffer
        const chunks: Buffer[] = [];
        for await (const chunk of Body) {
          chunks.push(Buffer.from(chunk));
        }
        const fileBuffer = Buffer.concat(chunks);

        console.log('[streamTestamentPdf] Successfully read PDF from S3.');

        // Enviar el archivo al cliente
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${key}"`);
        res.setHeader('Content-Length', ContentLength);

        console.log('[streamTestamentPdf] Streaming PDF to client...');
        res.end(fileBuffer);
      } catch (error) {
        console.log('Error reading from S3:', error);
        res.status(500).json({
          code: 500,
          msg: 'Internal error downloading PDF.',
          response: null,
        });
      }
    } catch (error) {
      console.log('[streamTestamentPdf] Unexpected error =>', error);
      res.status(500).json({
        code: 500,
        msg: 'Unexpected error streaming PDF.',
        response: null,
      });
    }
  }
}
