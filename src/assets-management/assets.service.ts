import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import { GeneralResponseDto } from 'src/common';
import { PrismaProvider } from '../providers';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class AssetsService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;

  constructor(private prismaprovider: PrismaProvider) {
    this._prismaprovider = prismaprovider;
  }

  async getUserAssets(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Tstament Error-> dxaj7 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!userExists) {
        response.code = 400;
        response.msg = 'User does not exist';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const assets = await this.prisma.asset.findMany({ where: { userId } });
      if (assets.length === 0) {
        response.code = 404;
        response.msg = 'No assets found';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Assets retrieved successfully';
      response.response = assets;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAssetById(assetId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> 2nj7 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId },
      });

      if (!asset || asset === null) {
        response.code = 404;
        response.msg = 'Asset not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Asset retrieved successfully';
      response.response = asset;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createAsset(
    userId: string,
    createAssetDto: CreateAssetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> cenc7 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        response.code = 400;
        response.msg = 'User does not exist';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // Validar si la categoría existe
      const categoryExists = await this.prisma.assetCategory.findUnique({
        where: { id: createAssetDto.categoryId },
      });

      if (!categoryExists || categoryExists === null) {
        response.code = 400;
        response.msg =
          'Invalid asset category. The specified category does not exist.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // Crear el activo si la categoría es válida
      const asset = await this.prisma.asset.create({
        data: { userId, ...createAssetDto },
      });

      response.code = 201;
      response.msg = 'Asset created successfully';
      response.response = asset;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateAsset(
    assetId: string,
    updateAssetDto: UpdateAssetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> ccb# db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (updateAssetDto.categoryId) {
        const categoryExists = await this.prisma.assetCategory.findUnique({
          where: { id: updateAssetDto.categoryId },
        });
        if (!categoryExists) {
          response.code = 400;
          response.msg =
            'Invalid asset category. The specified category does not exist.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
      }

      const existingAsset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });
      if (!existingAsset) {
        response.code = 404;
        response.msg = 'Asset not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const asset = await this.prisma.asset.update({
        where: { id: assetId },
        data: updateAssetDto,
      });

      response.code = 200;
      response.msg = 'Asset updated successfully';
      response.response = asset;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async deleteAsset(assetId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> dwd!2 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const existingAsset = await this.prisma.asset.findUnique({
        where: { id: assetId },
      });
      if (!existingAsset) {
        response.code = 404;
        response.msg = 'Asset not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      await this.prisma.asset.delete({ where: { id: assetId } });

      response.code = 200;
      response.msg = 'Asset deleted successfully';
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAssetsByCategory(categoryId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> 2nj7 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const category = await this.prisma.assetCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        response.code = 400;
        response.msg = 'Category does not exist';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      response.code = 200;
      response.msg = 'Assets retrieved successfully';
      response.response = category;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAllCategories(
    page: number,
    limit: number,
    categoryType?: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Convertir page y limit a números enteros
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;
      const whereClause = categoryType ? { type: categoryType } : {};

      const [categories, total] = await Promise.all([
        this.prisma.assetCategory.findMany({
          where: whereClause,
          skip: offset,
          take: limitNumber,
          orderBy: { name: 'asc' },
        }),
        this.prisma.assetCategory.count({ where: whereClause }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = 'No categories found';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Categories retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        categories,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
