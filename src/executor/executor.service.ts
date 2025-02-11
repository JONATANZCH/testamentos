import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateExecutorDto, UpdateExecutorDto } from './dto';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';

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
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      //Validate testamentHeaderId exists
      const testamentHeader = await this.prisma.testamentHeader.findUnique({
        where: { id: createExecutorDto.testamentHeaderId },
      });

      if (!testamentHeader) {
        response.code = 400;
        response.msg = `Testament not found`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // Validate contactId exists
      const contact = await this.prisma.contact.findUnique({
        where: { id: createExecutorDto.contactId },
      });

      if (!contact) {
        response.code = 400;
        response.msg = `Contact not found`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const executor = await this.prisma.executor.create({
        data: createExecutorDto,
      });

      response.code = 201;
      response.msg = 'Executor created successfully';
      response.response = executor;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getExecutorById(execId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const executor = await this.prisma.executor.findUnique({
        where: { id: execId },
      });

      if (!executor) {
        response.code = 404;
        response.msg = `Executor not exists`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Executor retrieved successfully';
      response.response = executor;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateExecutor(
    execId: string,
    updateExecutorDto: UpdateExecutorDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const executorExist = await this.prisma.executor.findUnique({
        where: { id: execId },
      });

      if (!executorExist) {
        response.code = 404;
        response.msg = `Executor not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      //Validate testamentHeaderId exists
      const testamentHeader = await this.prisma.testamentHeader.findUnique({
        where: { id: updateExecutorDto.testamentHeaderId },
      });

      if (!testamentHeader) {
        response.code = 400;
        response.msg = `Testament not found`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }
      // Validate contactId exists
      const contact = await this.prisma.contact.findUnique({
        where: { id: updateExecutorDto.contactId },
      });

      if (!contact) {
        response.code = 400;
        response.msg = `Contact not found`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const executor = await this.prisma.executor.update({
        where: { id: execId },
        data: updateExecutorDto,
      });

      response.code = 200;
      response.msg = 'Executor updated successfully';
      response.response = executor;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async deleteExecutor(execId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const executorExist = await this.prisma.executor.findUnique({
        where: { id: execId },
      });

      if (!executorExist) {
        response.code = 404;
        response.msg = `Executor not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
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
