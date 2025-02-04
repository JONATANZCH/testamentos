import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';

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
      const [entities, total] = await Promise.all([
        this.prisma.legalEntity.findMany({
          skip: offset,
          take: limitNumber,
          orderBy: { name: 'asc' },
        }),
        this.prisma.legalEntity.count(),
      ]);

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
      console.error('Error fetching legal entities:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while fetching legal entities';
      return response;
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
        return response;
      }

      const entity = await this.prisma.legalEntity.findUnique({
        where: { id },
      });

      if (!entity) {
        response.code = 404;
        response.msg = 'Legal entity not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Legal entity retrieved successfully';
      response.response = entity;
      return response;
    } catch (error) {
      console.error('Error fetching legal entity by id:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while fetching the legal entity';
      return response;
    }
  }
}
