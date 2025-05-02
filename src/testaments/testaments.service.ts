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
import { ConfigService } from '../config';
import { SqsService } from '../config/sqs-validate.service';
import { Prisma } from '@prisma/client';
import { UpdateTestamentMintDto, UpdateMinorSupportDto } from './dto';
import axios from 'axios';
import { Response } from 'express';

@Injectable()
export class TestamentsService {
  private prisma: any = null;
  private readonly mintApiUrl: string;
  private readonly getSqsCommNoWaitQueue: any;
  private s3 = new S3Client({
    region: process.env.AWSREGION,
  });

  // Validate valid state if provided
  private validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT'];

  constructor(
    private readonly prismaProvider: PrismaProvider,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
  ) {
    this.getSqsCommNoWaitQueue = this.configService.getSqsCommNoWaitQueue();
    this.mintApiUrl = this.configService.getMintApiUrl();
  }

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
          select: {
            id: true,
            version: true,
            status: true,
            creationDate: true,
          },
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

  async getTestamentById(testamentId: string, res: Response) {
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
        select: {
          id: true,
          status: true,
          version: true,
          terms: true,
          inheritanceType: true,
        },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Testament retrieved successfully';
      response.response = testament;
      return res.status(200).json(response);
    } catch (error) {
      console.log('Error getting testament:', error);
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

        const lastDoc = await tx.testamentHeader.findFirst({
          orderBy: { documentNumber: 'desc' },
          select: { documentNumber: true },
        });
        const nextDocumentNumber = (lastDoc?.documentNumber ?? 0) + 1;

        if (createTestamentDto.universalHeirId) {
          const heirExists = await tx.contact.findUnique({
            where: { id: createTestamentDto.universalHeirId },
          });
          if (!heirExists) {
            throw new HttpException(
              {
                code: 400,
                msg: 'The provided universalHeirId does not exist in Contact.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }

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
              documentNumber: nextDocumentNumber,
              status: 'DRAFT',
              terms: createTestamentDto.terms ?? activeTestament.terms,
              legalAdvisor:
                createTestamentDto.legalAdvisor ?? activeTestament.legalAdvisor,
              notes: createTestamentDto.notes ?? activeTestament.notes,
            },
            select: {
              id: true,
              status: true,
              version: true,
              inheritanceType: true,
              universalHeirId: true,
              creationDate: true,
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
                priorityOrder: executor.priorityOrder ?? 1,
              },
            });
          }
        } else {
          createdTestament = await tx.testamentHeader.create({
            data: {
              ...createTestamentDto,
              userId,
              version: newVersion,
              documentNumber: nextDocumentNumber,
              status: 'DRAFT',
            },
            select: {
              id: true,
              status: true,
              version: true,
              inheritanceType: true,
              universalHeirId: true,
              creationDate: true,
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

        if (updateTestamentDto.universalHeirId) {
          const heirExists = await tx.contact.findUnique({
            where: { id: updateTestamentDto.universalHeirId },
          });
          if (!heirExists) {
            throw new HttpException(
              {
                code: 400,
                msg: 'The provided universalHeirId does not exist in Contact.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        const updated = await tx.testamentHeader.update({
          where: { id: testamentId },
          data: updateTestamentDto,
          select: {
            id: true,
            status: true,
            version: true,
            inheritanceType: true,
            universalHeirId: true,
            updateDate: true,
          },
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

      const assignment = await this.prisma.$transaction(async (tx) => {
        // 1) Verificar que el testamento exista
        const testament = await tx.testamentHeader.findUnique({
          where: { id: testamentId },
        });
        if (!testament) {
          throw new HttpException(
            { code: 404, msg: 'Testament not found' },
            HttpStatus.NOT_FOUND,
          );
        }

        if (testament.inheritanceType !== 'HP') {
          throw new HttpException(
            {
              code: 400,
              msg: 'This testament is of type "HU" or "HL" and does not support assignments.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        if (testament.status !== 'DRAFT') {
          throw new HttpException(
            {
              code: 400,
              msg: 'You can only create assignments to wills in Draft..',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // 2) Validar que el asset exista y pertenezca al mismo userId
        if (createAssignmentDto.assetId) {
          const asset = await tx.asset.findUnique({
            where: { id: createAssignmentDto.assetId },
          });
          if (!asset) {
            throw new HttpException(
              {
                code: 400,
                msg: 'The provided assetId does not exist in the system',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (asset.userId !== testament.userId) {
            throw new HttpException(
              {
                code: 400,
                msg: 'The provided asset does not belong to the same user as the testament',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        // 3) Validar assignmentId según assignmentType
        if (createAssignmentDto.assignmentId) {
          if (createAssignmentDto.assignmentType === 'c') {
            // Buscar en Contact
            const contact = await tx.contact.findUnique({
              where: { id: createAssignmentDto.assignmentId },
            });
            if (!contact) {
              throw new HttpException(
                {
                  code: 400,
                  msg: 'The provided assignmentId does not exist in Contact.',
                },
                HttpStatus.BAD_REQUEST,
              );
            }
            // Verificar que el contact pertenezca al mismo userId
            if (contact.userId !== testament.userId) {
              throw new HttpException(
                {
                  code: 400,
                  msg: 'The provided assignmentId (Contact) does not belong to the same user as the testament.',
                },
                HttpStatus.BAD_REQUEST,
              );
            }
          } else if (createAssignmentDto.assignmentType === 'le') {
            const legalEntity = await tx.legalEntity.findUnique({
              where: { id: createAssignmentDto.assignmentId },
            });
            if (!legalEntity) {
              throw new HttpException(
                {
                  code: 400,
                  msg: 'The provided assignmentId does not exist in LegalEntity.',
                },
                HttpStatus.BAD_REQUEST,
              );
            }
          }
        }

        // 4) Obtener todas las asignaciones para (testament + assetId)
        //    con esto validamos si hay un duplicado Y calculamos porcentaje
        const existingAssignments = await tx.testamentAssignment.findMany({
          where: {
            testamentId,
            assetId: createAssignmentDto.assetId,
          },
          // Obtenemos tanto el assignmentId como el percentage
          select: { assignmentId: true, percentage: true },
        });

        // 4.1) Revisar si ya existe la misma combinación (testament + asset + assignmentId)
        if (
          existingAssignments.some(
            (a) => a.assignmentId === createAssignmentDto.assignmentId,
          )
        ) {
          throw new HttpException(
            {
              code: 400,
              msg: 'An assignment already exists for this contact/legal entity with the same asset. Cannot create duplicates.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // 4.2) Verificar que al sumar el nuevo porcentaje no exceda el 100%
        const currentPercentageSum = existingAssignments.reduce(
          (sum, a) => sum + a.percentage,
          0,
        );
        if (currentPercentageSum + createAssignmentDto.percentage > 100) {
          throw new HttpException(
            {
              code: 400,
              msg: 'The sum of the percentages cannot exceed 100% for this asset.',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // 5) Crear la asignación
        const newAssignment = await tx.testamentAssignment.create({
          data: {
            testamentId,
            ...createAssignmentDto,
          },
        });

        console.log('New assignment from Prisma:', newAssignment);
        return newAssignment;
      });

      response.code = 201;
      response.msg = 'Assignment created successfully';
      response.response = assignment;
      return response;
    } catch (error) {
      if (error.message?.includes('Transaction not found')) {
        throw new HttpException(
          {
            code: 400,
            msg: 'The transaction was cancelled because a duplicate allocation was detected for that asset.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
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

  async getTestamentAssignments(
    testamentId: string,
    paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const { page, limit } = paginationDto;

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
        select: { inheritanceType: true },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found.';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (
        testament.inheritanceType === 'HU' ||
        testament.inheritanceType === 'HL'
      ) {
        response.code = 400;
        response.msg =
          'This testament is of type "HU" or "HL" and does not have assignments.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (
        isNaN(pageNumber) ||
        isNaN(limitNumber) ||
        pageNumber < 1 ||
        limitNumber < 1
      ) {
        response.code = 400;
        response.msg = 'Page and limit must be valid positive numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;

      const whereClause: any = { testamentId };
      if (paginationDto.assignmentType) {
        whereClause.assignmentType = paginationDto.assignmentType;
      }

      const [assignments, total] = await Promise.all([
        this.prisma.testamentAssignment.findMany({
          where: whereClause,
          skip: offset,
          take: limitNumber,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            assetId: true,
            percentage: true,
            assignmentType: true,
            assignmentId: true,
          },
        }),
        this.prisma.testamentAssignment.count({ where: whereClause }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = paginationDto.assignmentType
          ? `No assignments found with type "${paginationDto.assignmentType}".`
          : 'No assignments found for this testament.';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Assignments retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        assignments,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAssignmentById(assignmentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const assignment = await this.prisma.testamentAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          assetId: true,
          percentage: true,
          assignmentType: true,
          assignmentId: true,
        },
      });

      if (!assignment) {
        response.code = 404;
        response.msg = 'Assignment not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Assignment retrieved successfully';
      response.response = assignment;
      return response;
    } catch (error) {
      processException(error);
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
        response.msg = 'PDF not found';
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

  async updateTestamentMint(
    testamentId: string,
    updateTestamentMintDto: UpdateTestamentMintDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) this.throwDbConnectionError(response);

      const { user, status, alreadyMinted } = await this.prisma.$transaction(
        async (tx) => {
          const testament = await this.getDraftTestamentWithUser(
            tx,
            testamentId,
          );

          const credit = await this.consumeUserCredit(tx, testament.userId);
          console.log('Credit ID used:', credit);

          let user = testament.user;
          let alreadyMinted = false;

          if (user.walletIntId) {
            alreadyMinted = true;
          } else {
            user = await this.assignWalletIntId(tx, user.id);
          }

          if (updateTestamentMintDto.status === 'ACTIVE') {
            await this.deactivateOtherActiveTestaments(
              tx,
              user.id,
              testamentId,
            );
          }

          return { user, status: updateTestamentMintDto.status, alreadyMinted };
        },
      );

      let updateData: any = { status };

      if (!alreadyMinted) {
        const mintData = await this.mintToCustodialWallet(user.walletIntId);
        console.log('Mint data:', mintData);

        updateData = {
          ...updateData,
          hash: mintData.txHash,
          urlNft: mintData.urlNft,
          chain: mintData.chain,
          standard: mintData.standard,
        };
      }

      const updatedTestament = await this.prisma.testamentHeader.update({
        where: { id: testamentId },
        data: updateData,
        select: {
          id: true,
          status: true,
          version: true,
          documentNumber: true,
          hash: true,
          urlNft: true,
          chain: true,
          standard: true,
        },
      });

      await this.notifyMintEmail(user, true);

      response.code = 200;
      response.msg = alreadyMinted
        ? 'Testament status updated (previous mint preserved)'
        : 'Testament status updated and NFT minted successfully';
      response.response = updatedTestament;
      return response;
    } catch (error) {
      console.log('Error updating testament mint:', error);
      processException(error);
    }
  }

  async updateMinorSupport(
    testamentId: string,
    body: UpdateMinorSupportDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> wills cj90d2');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!body.tutor || !body.tutor.main) {
        throw new HttpException(
          'Tutor.main is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
        select: {
          id: true,
          inheritanceType: true,
          userId: true,
          universalHeirId: true,
        },
      });

      if (!testament) {
        console.log('testament not found');
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      let hasMinor = false;

      // ⚠️ Validación de menor de edad según tipo de testamento
      if (testament.inheritanceType === 'HU' && testament.universalHeirId) {
        const heir = await this.prisma.contact.findUnique({
          where: { id: testament.universalHeirId },
          select: { birthDate: true },
        });

        if (heir?.birthDate) {
          const now = new Date();
          const eighteenYearsAgo = new Date(
            now.getFullYear() - 18,
            now.getMonth(),
            now.getDate(),
          );
          hasMinor = heir.birthDate > eighteenYearsAgo;
        }
      }

      if (testament.inheritanceType === 'HP') {
        const assignments = await this.prisma.testamentAssignment.findMany({
          where: {
            testamentId: testament.id,
            assignmentType: 'c',
          },
          select: { assignmentId: true },
        });

        if (!assignments || assignments.length === 0) {
          console.log('No assignments found for this testament');
          response.code = 400;
          response.msg = 'No assignments found for this testament';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }

        const contactIds = assignments
          .map((a) => a.assignmentId)
          .filter(Boolean);

        if (contactIds.length > 0) {
          const contacts = await this.prisma.contact.findMany({
            where: {
              id: { in: contactIds },
            },
            select: { id: true, birthDate: true },
          });

          const now = new Date();
          const eighteenYearsAgo = new Date(
            now.getFullYear() - 18,
            now.getMonth(),
            now.getDate(),
          );

          hasMinor = contacts.some(
            (c) => c.birthDate && c.birthDate > eighteenYearsAgo,
          );
        }
      }

      if (!hasMinor) {
        const legacyContacts = await this.prisma.legacy.findMany({
          where: {
            testamentId: testament.id,
            contactId: { not: null },
          },
          select: {
            contact: {
              select: {
                id: true,
                birthDate: true,
              },
            },
          },
        });

        const now = new Date();
        const eighteenYearsAgo = new Date(
          now.getFullYear() - 18,
          now.getMonth(),
          now.getDate(),
        );

        hasMinor = legacyContacts.some(
          (entry) =>
            entry.contact?.birthDate &&
            entry.contact.birthDate > eighteenYearsAgo,
        );
      }

      if (!hasMinor) {
        response.code = 400;
        response.msg =
          'No minor beneficiaries found. Tutor/Guardian cannot be assigned.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // ✅ Validación de dependencia tutor -> guardián
      if (body.guardian && !body.tutor) {
        console.log('Cannot assign guardian without tutor');
        response.code = 400;
        response.msg = 'Cannot assign guardian without tutor';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // ✅ Validar que no se repita ningún ID entre tutor y guardian
      const tutorIds = [body.tutor.main];
      if (body.tutor.substitute) tutorIds.push(body.tutor.substitute);

      const guardianIds = [];
      if (body.guardian?.main) guardianIds.push(body.guardian.main);
      if (body.guardian?.substitute) guardianIds.push(body.guardian.substitute);

      const duplicatedIds = tutorIds.filter((id) => guardianIds.includes(id));
      if (duplicatedIds.length > 0) {
        throw new HttpException(
          `Tutor and Guardian cannot share the same contact(s): ${duplicatedIds.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // ✅ Validar existencia de contactos
      const allContactIds = [...tutorIds, ...guardianIds];
      const foundContacts = await this.prisma.contact.findMany({
        where: { id: { in: allContactIds }, userId: testament.userId },
        select: { id: true },
      });
      const foundIds = foundContacts.map((c) => c.id);
      const missing = allContactIds.filter((id) => !foundIds.includes(id));
      if (missing.length > 0) {
        throw new HttpException(
          `The following contact(s) were not found or do not belong to the user: ${missing.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // ✅ Construir payload dinámicamente
      const minorSupportPayload: any = {
        tutor: {
          main: body.tutor.main,
          ...(body.tutor.substitute && { substitute: body.tutor.substitute }),
        },
      };

      if (body.guardian) {
        minorSupportPayload.guardian = {
          main: body.guardian.main,
          ...(body.guardian.substitute && {
            substitute: body.guardian.substitute,
          }),
        };
      }

      const updatedTestament = await this.prisma.testamentHeader.update({
        where: { id: testamentId },
        data: { minorSupport: minorSupportPayload },
        select: { id: true, minorSupport: true },
      });

      response.code = 200;
      response.msg = 'Minor support updated successfully';
      response.response = updatedTestament;
      return response;
    } catch (error) {
      console.log('Error updating minor support:', error);
      processException(error);
    }
  }

  async getMinorSupport(testamentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        throw new HttpException(
          'DB connection error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
        select: { id: true, minorSupport: true, userId: true },
      });
      if (!testament) {
        throw new HttpException('Testament not found', HttpStatus.NOT_FOUND);
      }

      const minorSupport = testament.minorSupport;
      if (!minorSupport || Object.keys(minorSupport).length === 0) {
        response.code = 404;
        response.msg = 'No tutor or guardian defined yet for this testament';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const contactIds: string[] = [];
      const addId = (id?: string) => {
        if (id && typeof id === 'string') contactIds.push(id);
      };
      addId(minorSupport?.tutor?.main);
      addId(minorSupport?.tutor?.substitute);
      addId(minorSupport?.guardian?.main);
      addId(minorSupport?.guardian?.substitute);

      const contacts = await this.prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          userId: testament.userId,
        },
        select: {
          id: true,
          name: true,
          middleName: true,
          fatherLastName: true,
          motherLastName: true,
          relationToUser: true,
          country: true,
          gender: true,
          birthDate: true,
          phoneNumber: true,
          email: true,
        },
      });

      const contactMap = Object.fromEntries(contacts.map((c) => [c.id, c]));
      const resolveContact = (id?: string) =>
        id ? (contactMap[id] ?? { id, notFound: true }) : undefined;

      const enrichedMinorSupport: any = {};

      if (minorSupport.tutor) {
        enrichedMinorSupport.tutor = {
          ...(minorSupport.tutor.main && {
            main: resolveContact(minorSupport.tutor.main),
          }),
          ...(minorSupport.tutor.substitute && {
            substitute: resolveContact(minorSupport.tutor.substitute),
          }),
        };
      }

      if (minorSupport.guardian) {
        enrichedMinorSupport.guardian = {
          ...(minorSupport.guardian.main && {
            main: resolveContact(minorSupport.guardian.main),
          }),
          ...(minorSupport.guardian.substitute && {
            substitute: resolveContact(minorSupport.guardian.substitute),
          }),
        };
      }

      response.code = 200;
      response.msg = 'Minor support data retrieved';
      response.response = enrichedMinorSupport;
      return response;
    } catch (error) {
      console.log('Error retrieving minor support:', error);
      processException(error);
    }
  }

  async notifyMintEmail(user: any, success: boolean): Promise<boolean> {
    try {
      const userInfo = await this.prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!userInfo || !userInfo.email) {
        console.warn(
          `[notifyMintEmail] No email found for userId=${userInfo?.id}`,
        );
        return true;
      }

      const emailPayload = {
        type: 'new',
        metadata: {
          body: {
            provider: 'sendgrid',
            commType: 'email',
            data: [
              {
                msg: {
                  to: userInfo.email,
                  from: 'notificaciones@testamentos.com',
                  templateId: success
                    ? process.env.SG_TEMPLATE_MINT_CONFIRMATION
                    : process.env.SG_TEMPLATE_MINT_CONFIRMATION,
                  dynamicTemplateData: {
                    subject: success
                      ? '¡Tu testamento fue minteado con éxito!'
                      : 'Error al mintear tu testamento',
                    name: userInfo.name,
                    fecha: new Date().toLocaleDateString(),
                  },
                },
              },
            ],
          },
        },
      };

      const queueUrl = this.getSqsCommNoWaitQueue;
      await this.sqsService.sendMessage(queueUrl, emailPayload);
      console.log(
        `[notifyMintEmail] Mint email (${success ? 'SUCCESS' : 'FAILED'}) sent for userId=${userInfo.id}`,
      );
      return true;
    } catch (error) {
      console.error(
        `[notifyMintEmail] Error sending ${success ? 'success' : 'failure'} email for userId=${user.id}:`,
        error,
      );
      return false;
    }
  }

  private throwDbConnectionError(response: GeneralResponseDto): never {
    console.log('Error-> db-connection-failed');
    response.code = 500;
    response.msg = 'Could not connect to the database';
    throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private async getDraftTestamentWithUser(tx: any, testamentId: string) {
    const testament = await tx.testamentHeader.findUnique({
      where: { id: testamentId },
      include: { user: true },
    });
    if (!testament) {
      throw new HttpException(
        { code: 404, msg: 'Testament not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (testament.status !== 'DRAFT') {
      throw new HttpException(
        { code: 400, msg: 'Only draft testaments can be updated' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return testament;
  }

  private async consumeUserCredit(tx: any, userId: string) {
    const now = new Date();
    let credit = await tx.userCredits.findFirst({
      where: {
        userId,
        status: 'New',
        type: 'subscription',
        expirationDate: { gte: now },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!credit) {
      credit = await tx.userCredits.findFirst({
        where: {
          userId,
          status: 'New',
          type: 'addon',
          expirationDate: { gte: now },
        },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!credit) {
      throw new HttpException(
        { code: 400, msg: 'User has no available credits' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await tx.userCredits.update({
      where: { id: credit.id },
      data: { status: 'Used', usedDate: now },
    });
    return credit;
  }

  private async assignWalletIntId(tx: any, userId: string) {
    let assigned = false;
    let retries = 0;
    const MAX_RETRIES = 5;
    let user;
    let nextId: number | null = null;

    while (!assigned && retries < MAX_RETRIES) {
      try {
        const max = await tx.user.aggregate({ _max: { walletIntId: true } });
        nextId = (max._max.walletIntId ?? 0) + 1;

        console.log(
          `[walletIntId] Attempting to assign walletIntId=${nextId} to userId=${userId} (retry=${retries})`,
        );

        user = await tx.user.update({
          where: { id: userId },
          data: { walletIntId: nextId },
        });

        console.log(
          `[walletIntId] Successfully assigned walletIntId=${nextId} to userId=${userId}`,
        );

        assigned = true;
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const target = err.meta?.target as string[] | string;
          if (
            (Array.isArray(target) && target.includes('walletIntId')) ||
            target === 'walletIntId'
          ) {
            retries++;
            console.warn(
              `[walletIntId] Unique constraint failed (walletIntId=${nextId}). Retrying (${retries}/${MAX_RETRIES})...`,
            );
            await new Promise((r) => setTimeout(r, 100));
          }
        } else {
          console.error('[walletIntId] Unexpected error:', err);
          throw err;
        }
      }
    }

    if (!assigned) {
      console.error(
        `[walletIntId] Failed to assign walletIntId after ${MAX_RETRIES} retries`,
      );
      throw new HttpException(
        { code: 500, msg: 'Failed to assign walletIntId after retries' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return user;
  }

  private async deactivateOtherActiveTestaments(
    tx: any,
    userId: string,
    excludeId: string,
  ) {
    await tx.testamentHeader.updateMany({
      where: { userId, status: 'ACTIVE', id: { not: excludeId } },
      data: { status: 'INACTIVE' },
    });
  }

  private async mintToCustodialWallet(walletIntId: number) {
    try {
      const { data } = await axios.post(this.mintApiUrl, {
        userId: walletIntId,
        image: 'http://asdf',
        product: 'testamentos',
      });
      console.log('[mintToCustodialWallet] Mint service response:', data);

      if (!data || data.code !== 200 || !data.response) {
        console.error('[mintToCustodialWallet] Invalid response:', data);
        throw new HttpException(
          {
            code: 502,
            msg: 'Unexpected response structure from mint fargate service',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      console.log('[mintToCustodialWallet] Mint service msg:', data.msg);

      const { txHash, urlNft, chain, standard } = data.response;

      if (!txHash || !urlNft || !chain || !standard) {
        throw new HttpException(
          {
            code: 502,
            msg: 'Incomplete data received from mint service',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      return { txHash, urlNft, chain, standard };
    } catch (error) {
      console.error(
        '[mintToCustodialWallet] Error minting NFT:',
        error.message || error,
      );
      throw new HttpException(
        {
          code: 502,
          msg: 'Failed to mint NFT on blockchain',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
