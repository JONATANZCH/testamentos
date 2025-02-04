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

    if (status && !this.validStatuses.includes(status)) {
      response.code = 400;
      response.msg = 'Invalid testament status provided';
      return response;
    }

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const { page, limit } = paginationDto;
      const offset = (page - 1) * limit;

      // Build dynamic filters
      const whereClause: any = { userId };
      if (status) whereClause.status = status;
      if (version) whereClause.version = version;

      const [testaments, total] = await Promise.all([
        this.prisma.testamentHeader.findMany({
          where: whereClause,
          skip: offset,
          take: limit,
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

  async getTestamentById(
    userId: string,
    testamentId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const testament = await this.prisma.testamentHeader.findFirst({
        where: { id: testamentId, userId },
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
    userId: string,
    testamentId: string,
    updateTestamentDto: UpdateTestamentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const testament = await this.prisma.testamentHeader.update({
        where: { id: testamentId },
        data: updateTestamentDto,
      });

      response.code = 200;
      response.msg = 'Testament updated successfully';
      response.response = testament;
      return response;
    } catch (error) {
      console.error('Error updating testament:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while updating the testament';
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
    userId: string,
    testamentId: string,
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
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

      // **Percent Validation**
      const existingAssignments =
        await this.prisma.testamentAssignment.findMany({
          where: { testamentId },
          select: { percentage: true },
        });

      // Add the existing percentages
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
      console.error('Error creating assignment:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while creating the assignment';
      return response;
    }
  }
}
