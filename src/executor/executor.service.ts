import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateExecutorDto, UpdateExecutorDto } from './dto';
import { GeneralResponseDto } from '../common';

@Injectable()
export class ExecutorService {
  private prisma: any;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async createExecutor(
    createExecutorDto: CreateExecutorDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        return response;
      }

      //Validate testamentHeaderId exists
      const testamentHeader = await this.prisma.testamentHeader.findUnique({
        where: { id: createExecutorDto.testamentHeaderId },
      });

      if (!testamentHeader) {
        response.code = 400;
        response.msg = `Testament not found`;
        return response;
      }

      // Validate contactId exists
      const contact = await this.prisma.contact.findUnique({
        where: { id: createExecutorDto.contactId },
      });

      if (!contact) {
        response.code = 400;
        response.msg = `Contact not found`;
        return response;
      }

      const executor = await this.prisma.executor.create({
        data: createExecutorDto,
      });

      response.code = 201;
      response.msg = 'Executor created successfully';
      response.response = executor;
      return response;
    } catch (error) {
      console.error('Error creating executor:', error);
      response.code = 500;
      response.msg = 'An error occurred while creating the executor';
      return response;
    }
  }

  async getExecutorById(execId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    this.prisma = await this.prismaProvider.getPrismaClient();

    try {
      const executor = await this.prisma.executor.findUnique({
        where: { id: execId },
      });

      if (!executor) {
        response.code = 404;
        response.msg = `Executor not exists`;
        return response;
      }

      response.code = 200;
      response.msg = 'Executor retrieved successfully';
      response.response = executor;
      return response;
    } catch (error) {
      console.error('Error retrieving executor:', error);
      response.code = 500;
      response.msg = 'An error occurred while retrieving the executor';
      return response;
    }
  }

  async updateExecutor(
    execId: string,
    updateExecutorDto: UpdateExecutorDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    this.prisma = await this.prismaProvider.getPrismaClient();

    try {
      const executor = await this.prisma.executor.update({
        where: { id: execId },
        data: updateExecutorDto,
      });

      response.code = 200;
      response.msg = 'Executor updated successfully';
      response.response = executor;
      return response;
    } catch (error) {
      console.error('Error updating executor:', error);
      response.code = 500;
      response.msg = 'An error occurred while updating the executor';
      return response;
    }
  }

  async deleteExecutor(execId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    this.prisma = await this.prismaProvider.getPrismaClient();

    try {
      const executor = await this.prisma.executor.delete({
        where: { id: execId },
      });

      response.code = 200;
      response.msg = 'Executor deleted successfully';
      response.response = executor;
      return response;
    } catch (error) {
      console.error('Error deleting executor:', error);
      response.code = 500;
      response.msg = 'An error occurred while deleting the executor';
      return response;
    }
  }
}
