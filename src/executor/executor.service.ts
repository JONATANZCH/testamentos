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
    testamentId: string,
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

      const testamentHeader = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
        select: { id: true, status: true, userId: true },
      });
      if (!testamentHeader) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (testamentHeader.status !== 'DRAFT') {
        response.code = 400;
        response.msg =
          'You can only create executors for a testament in DRAFT status.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      if (createExecutorDto.accepted === false) {
        const declined = await this.prisma.executor.create({
          data: {
            testamentHeaderId: testamentId,
            accepted: false,
            declinedAt: new Date(),
          },
          select: {
            id: true,
            accepted: true,
            declinedAt: true,
          },
        });

        response.code = 201;
        response.msg = 'Executor creation declined by user';
        response.response = declined;
        return response;
      }

      const contact = await this.prisma.contact.findUnique({
        where: { id: createExecutorDto.contactId },
        select: { userId: true },
      });
      if (!contact) {
        response.code = 400;
        response.msg = 'Contact not found';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      if (contact.userId !== testamentHeader.userId) {
        response.code = 400;
        response.msg =
          'Contact does not belong to the same user as the testament.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const sameContactExecutor = await this.prisma.executor.findFirst({
        where: {
          testamentHeaderId: testamentId,
          contactId: createExecutorDto.contactId,
        },
        select: { id: true },
      });
      if (sameContactExecutor) {
        response.code = 400;
        response.msg = `There's already an executor with id '${createExecutorDto.contactId}' for this testament.`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const countExecutors = await this.prisma.executor.count({
        where: { testamentHeaderId: testamentId },
      });
      if (countExecutors >= 4) {
        response.code = 400;
        response.msg = 'You already have 4 executors. Limit reached.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const newPriorityOrder = countExecutors + 1;

      const executor = await this.prisma.executor.create({
        data: {
          testamentHeaderId: testamentId,
          contactId: createExecutorDto.contactId,
          type: createExecutorDto.type ?? null,
          priorityOrder: newPriorityOrder,
        },
        select: {
          id: true,
          testamentHeaderId: true,
          createdAt: true,
        },
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

  async getUserExecutors(userId: string): Promise<GeneralResponseDto> {
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

      const userExists = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (!userExists) {
        response.code = 404;
        response.msg = 'User not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const executors = await this.prisma.executor.findMany({
        where: {
          testamentHeader: {
            userId: userId,
          },
        },
      });

      if (!executors || executors.length === 0) {
        response.code = 204;
        response.msg = `You don't have any executors`;
        throw new HttpException(response, HttpStatus.NO_CONTENT);
      }

      response.code = 200;
      response.msg = 'Executors retrieved successfully';
      response.response = executors;
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
      const existingExecutor = await this.prisma.executor.findUnique({
        where: { id: execId },
        select: {
          id: true,
          testamentHeaderId: true,
          contactId: true,
          priorityOrder: true,
        },
      });
      if (!existingExecutor) {
        response.code = 404;
        response.msg = `Executor not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: existingExecutor.testamentHeaderId },
        select: { id: true, status: true, userId: true },
      });
      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      if (testament.status !== 'DRAFT') {
        response.code = 400;
        response.msg =
          'You can only update executors if the testament is in DRAFT status.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const updatedExecutor = await this.prisma.$transaction(async (tx) => {
        if (
          updateExecutorDto.contactId &&
          updateExecutorDto.contactId !== existingExecutor.contactId
        ) {
          const contact = await tx.contact.findUnique({
            where: { id: updateExecutorDto.contactId },
            select: { userId: true },
          });
          if (!contact) {
            throw new HttpException(
              { code: 400, msg: 'New contact not found' },
              HttpStatus.BAD_REQUEST,
            );
          }
          if (contact.userId !== testament.userId) {
            throw new HttpException(
              {
                code: 400,
                msg: 'Contact does not belong to the testament user.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
          const sameContactExecutor = await tx.executor.findFirst({
            where: {
              testamentHeaderId: existingExecutor.testamentHeaderId,
              contactId: updateExecutorDto.contactId,
            },
          });
          if (sameContactExecutor) {
            throw new HttpException(
              {
                code: 400,
                msg: 'Contact already used as executor in this testament.',
              },
              HttpStatus.BAD_REQUEST,
            );
          }
        }

        // (B) Manejar drag & drop => reorder
        let newPriority = updateExecutorDto.priorityOrder;
        const oldPriority = existingExecutor.priorityOrder;

        if (newPriority && newPriority !== oldPriority) {
          const totalExecutors = await tx.executor.count({
            where: { testamentHeaderId: existingExecutor.testamentHeaderId },
          });
          if (newPriority > totalExecutors) {
            newPriority = totalExecutors;
          }

          if (newPriority < oldPriority) {
            await tx.executor.updateMany({
              where: {
                testamentHeaderId: existingExecutor.testamentHeaderId,
                priorityOrder: {
                  gte: newPriority,
                  lt: oldPriority,
                },
              },
              data: {
                priorityOrder: {
                  increment: 1,
                },
              },
            });
          } else {
            await tx.executor.updateMany({
              where: {
                testamentHeaderId: existingExecutor.testamentHeaderId,
                priorityOrder: {
                  gt: oldPriority,
                  lte: newPriority,
                },
              },
              data: {
                priorityOrder: {
                  decrement: 1,
                },
              },
            });
          }
        }

        const updated = await tx.executor.update({
          where: { id: execId },
          data: updateExecutorDto,
          select: {
            id: true,
            testamentHeaderId: true,
            priorityOrder: true,
            updatedAt: true,
          },
        });

        return updated;
      });

      response.code = 200;
      response.msg = 'Executor updated successfully with drag-and-drop reorder';
      response.response = updatedExecutor;
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
      console.log('Executor deleted:', executor);

      response.code = 200;
      response.msg = 'Executor deleted successfully';
      response.response = {};
      return response;
    } catch (error) {
      console.error('Error deleting executor:', error);
      response.code = 500;
      response.msg = 'An error occurred while deleting the executor';
      return response;
    }
  }
}
