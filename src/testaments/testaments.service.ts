import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import {
  CreateTestamentDto,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  UpdateTestamentDto,
} from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { UpdateTestamentStatusDto } from './dto/update-testament-tatus.dto';
import { Response } from 'express';

@Injectable()
export class TestamentsService {
  private prisma: any = null;
  private s3 = new S3Client({
    region: process.env.AWSREGION,
  });

  // Validate valid state if provided
  private validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT'];

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

  async updateTestament(
    testamentId: string,
    updateTestamentDto: UpdateTestamentDto,
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

      const updatedTestament = await this.prisma.$transaction(async (tx) => {
        // Buscar el testamento a actualizar
        const testamentExists = await tx.testamentHeader.findUnique({
          where: { id: testamentId },
        });
        if (!testamentExists) {
          throw new HttpException(
            { code: 404, msg: 'Testament not found' },
            HttpStatus.NOT_FOUND,
          );
        }

        // Solo se permite actualizar si el testamento está en estado DRAFT
        if (testamentExists.status !== 'DRAFT') {
          throw new HttpException(
            { code: 400, msg: 'Only draft testaments can be updated.' },
            HttpStatus.BAD_REQUEST,
          );
        }

        const updated = await tx.testamentHeader.update({
          where: { id: testamentId },
          data: updateTestamentDto,
        });
        return updated;
      });

      response.code = 200;
      response.msg = 'Testament updated successfully';
      response.response = updatedTestament;
      return response;
    } catch (error) {
      processException(error);
    }
  }

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
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Validar que la asignación exista
      const existingAssignment =
        await this.prisma.testamentAssignment.findUnique({
          where: { id: assignmentId },
        });

      if (!existingAssignment) {
        response.code = 404;
        response.msg = 'Assignment not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Validar assetId si se modifica
      if (updateAssignmentDto.assetId) {
        const assetExists = await this.prisma.asset.findUnique({
          where: { id: updateAssignmentDto.assetId },
        });
        if (!assetExists) {
          response.code = 400;
          response.msg = 'The provided assetId does not exist';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
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
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
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
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
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
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // 1. Verifica que el testamento exista
      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
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

  async streamTestamentPdf(testamentId: string, res: Response) {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.error('[streamTestamentPdf] Could not connect to the database');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      console.log('[streamTestamentPdf] Connected to database.');

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        console.log('[streamTestamentPdf] Testament not found.');
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      console.log(
        `[streamTestamentPdf] Testament found - Status: ${testament.status}`,
      );
      const status = testament.pdfStatus;
      if (!status) {
        console.log('[streamTestamentPdf] PDF status not found.');
        response.code = 404;
        response.msg = 'PDF status not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (status === 'PdfQueued' || status === 'GeneratingHtml') {
        console.log('[streamTestamentPdf] PDF is still being generated.');
        response.code = 202;
        response.msg = 'PDF in process. Please check back later.';
        response.response = { pdfProcessId: testamentId };
        throw new HttpException(response, HttpStatus.ACCEPTED);
      }
      if (status === 'Failed') {
        console.log('[streamTestamentPdf] PDF generation failed.');
        response.code = 406;
        response.msg =
          'There was an error generating the PDF. Please contact support.';
        response.response = { pdfProcessId: testamentId };
        throw new HttpException(response, HttpStatus.NOT_ACCEPTABLE);
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
        console.log('[streamTestamentPdf] Error parsing URL:', error);
        response.code = 500;
        response.msg = 'Invalid URL format in database.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      console.log(
        `[streamTestamentPdf] Fetching from S3: Bucket=${bucket}, Key=${key}`,
      );

      try {
        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await this.s3.send(command);
        console.log('[streamTestamentPdf] S3 response:', response);

        if (!response.Body) {
          console.log('[streamTestamentPdf] S3 response body is null');
          throw new HttpException(
            'Empty PDF response',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const buffer = Buffer.from(await response.Body.transformToByteArray());

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${testamentId}.pdf"`,
        });

        res.send(buffer);
      } catch (error) {
        console.log('Error reading from S3:', error);
        response.code = 500;
        response.msg = 'Error reading from S3';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      console.log('[streamTestamentPdf] Unexpected error =>', error);
      processException(error);
    }
  }

  async updateTestamentStatus(
    testamentId: string,
    updateTestamentStatusDto: UpdateTestamentStatusDto,
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

      const updatedTestament = await this.prisma.$transaction(async (tx) => {
        // Buscar el testamento por ID
        const testament = await tx.testamentHeader.findUnique({
          where: { id: testamentId },
        });
        if (!testament) {
          throw new HttpException(
            { code: 404, msg: 'Testament not found' },
            HttpStatus.NOT_FOUND,
          );
        }
        // Solo se permite actualizar el status si el testamento es DRAFT
        if (testament.status !== 'DRAFT') {
          throw new HttpException(
            {
              code: 400,
              msg: 'Only draft testaments can have their status changed.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        // si se desea cambiar a ACTIVE, no exista otro testamento ACTIVE para el mismo usuario
        if (updateTestamentStatusDto.status === 'ACTIVE') {
          const existingActiveTestament = await tx.testamentHeader.findFirst({
            where: {
              userId: testament.userId,
              status: 'ACTIVE',
              id: { not: testamentId },
            },
          });
          if (existingActiveTestament) {
            throw new HttpException(
              { code: 400, msg: 'The user already has an active testament.' },
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        // Actualizar el status del testamento
        const updated = await tx.testamentHeader.update({
          where: { id: testamentId },
          data: { status: updateTestamentStatusDto.status },
        });
        return updated;
      });

      response.code = 200;
      response.msg = 'Testament status updated successfully';
      response.response = updatedTestament;
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
