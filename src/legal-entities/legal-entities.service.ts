import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class LegalEntitiesService {
  private prisma: any = null;

  constructor(private prismaprovider: PrismaProvider) {}

  async getLegalEntities(
    page: number,
    limit: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
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
        return response;
      }

      const offset = (pageNumber - 1) * limitNumber;
      const [entities, total] = await Promise.all([
        this.prisma.legalEntity.findMany({
          skip: offset,
          take: limitNumber,
          orderBy: { name: 'asc' },
        }),
        this.prisma.legalEntity.count(),
      ]);

      if (total === 0 || entities.length === 0) {
        response.code = 404;
        response.msg = 'No legal entities found';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Legal entities retrieved successfully';
      response.response = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        entities,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getLegalEntityById(id: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const entity = await this.prisma.legalEntity.findUnique({
        where: { id },
      });

      if (!entity) {
        response.code = 404;
        response.msg = 'Legal entity not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Legal entity retrieved successfully';
      response.response = entity;
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
