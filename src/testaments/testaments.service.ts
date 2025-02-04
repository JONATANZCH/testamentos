import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import {
  CreateTestamentDto,
  UpdateTestamentDto,
  CreateAssignmentDto,
} from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';

@Injectable()
export class TestamentsService {
  private prisma: any = null;
  // Validate valid state if provided
  private validStatuses = ['ACTIVE', 'INACTIVE', 'DELETED', 'EXPIRED'];

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
      return response;
    }

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      // Convert page and limit to integers
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        return response;
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
        return response;
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
      console.error('Error fetching testaments:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching testaments';
      return response;
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
        return response;
      }
      const testament = await this.prisma.testamentHeader.findFirst({
        where: { id: testamentId },
        include: { TestamentAssignment: true },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Testament retrieved successfully';
      response.response = testament;
      return response;
    } catch (error) {
      console.error('Error fetching testament:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while fetching the testament';
      return response;
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
        return response;
      }

      // Validate if the contactId exists, if it was provided
      if (createTestamentDto.contactId) {
        const contactExists = await this.prisma.contact.findUnique({
          where: { id: createTestamentDto.contactId },
        });
        if (!contactExists) {
          response.code = 400;
          response.msg = 'The provided contactId does not exist';
          return response;
        }
      }

      // Create new Version
      const lastVersion = await this.prisma.testamentHeader.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const newVersion = (lastVersion?.version || 0) + 1;

      // Deactivate previous active testament
      await this.prisma.testamentHeader.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      });

      const newTestament = await this.prisma.testamentHeader.create({
        data: {
          ...createTestamentDto,
          userId,
          version: newVersion,
          status: 'ACTIVE',
        },
      });

      response.code = 201;
      response.msg = 'Testament created successfully';
      response.response = newTestament;
      return response;
    } catch (error) {
      console.error('Error creating testament:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while creating the testament';
      return response;
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
        return response;
      }
      // Validate if contactId has been sent and check its existence
      if (updateTestamentDto.contactId) {
        const contactExists = await this.prisma.contact.findUnique({
          where: { id: updateTestamentDto.contactId },
        });

        if (!contactExists) {
          response.code = 400;
          response.msg =
            'Invalid contactId: The contact does not exist in the system.';
          return response;
        }
      }

      const testament = await this.prisma.testamentHeader.update({
        where: { id: testamentId },
        data: updateTestamentDto,
      });

      response.code = 200;
      response.msg = 'Testament updated successfully';
      response.response = testament;
      return response;
    } catch (error) {
      // Catch known Prisma bugs (e.g. foreign key constraints)
      if (error.code === 'P2003') {
        response.code = 400;
        response.msg = `Invalid data: Foreign key constraint failed on field "${error.meta?.field_name}".`;
      } else if (error.code === 'P2025') {
        // Prism error when record does not exist
        response.code = 404;
        response.msg =
          'Testament not found: The provided testamentId does not exist.';
      } else {
        // Other unforeseen errors
        console.error('Unexpected error updating testament:', error);
        response.code = 500;
        response.msg =
          'An unexpected error occurred while updating the testament.';
      }

      return response;
    }
  }

  async deleteTestament(
    userId: string,
    testamentId: string,
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
      await this.prisma.testamentHeader.delete({ where: { id: testamentId } });

      response.code = 200;
      response.msg = 'Testament deleted successfully';
      return response;
    } catch (error) {
      console.error('Error deleting testament:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while deleting the testament';
      return response;
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
        return response;
      }
      // Validate that the testament exists for the given userId
      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });

      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        return response;
      }
      // Validate that the testament is active
      if (testament.status !== 'ACTIVE') {
        response.code = 400;
        response.msg = 'The testament is not active';
        return response;
      }

      // Validate if the assetId exists
      const assetExists = await this.prisma.asset.findUnique({
        where: { id: createAssignmentDto.assetId },
      });

      if (!assetExists) {
        response.code = 400;
        response.msg = 'The provided assetId does not exist';
        return response;
      }

      // Validate if the beneficiaryContactId exists, if it was provided
      if (createAssignmentDto.beneficiaryContactId) {
        const contactExists = await this.prisma.contact.findUnique({
          where: { id: createAssignmentDto.beneficiaryContactId },
        });
        if (!contactExists) {
          response.code = 400;
          response.msg = 'The provided beneficiaryContactId does not exist';
          return response;
        }
      }

      // Retrieve existing assignment percentages for the testament
      const existingAssignments =
        await this.prisma.testamentAssignment.findMany({
          where: { testamentId },
          select: { percentage: true },
        });

      // Add up the existing assignment percentages
      const currentPercentageSum: number = existingAssignments.reduce(
        (sum: number, assignment: { percentage: number }) =>
          sum + assignment.percentage,
        0,
      );

      // Validate that the percentage is greater than 0
      if (createAssignmentDto.percentage <= 0) {
        response.code = 400;
        response.msg = 'Percentage must be greater than 0';
        return response;
      }

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
      console.error('Error creating assignment:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while creating the assignment';
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
}
