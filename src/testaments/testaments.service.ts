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

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserTestaments(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const { page, limit } = paginationDto;
      const offset = (page - 1) * limit;

      const [testaments, total] = await Promise.all([
        this.prisma.testamentHeader.findMany({
          where: { userId },
          skip: offset,
          take: limit,
          orderBy: { creationDate: 'desc' },
        }),
        this.prisma.testamentHeader.count({ where: { userId } }),
      ]);

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
      // Deactivate previous versions of the will
      await this.prisma.testamentHeader.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      // Create new Version
      const lastVersion = await this.prisma.testamentHeader.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const newVersion = (lastVersion?.version || 0) + 1;

      const newTestament = await this.prisma.testamentHeader.create({
        data: {
          ...createTestamentDto,
          userId,
          version: newVersion,
          isActive: true,
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
