import { Injectable } from '@nestjs/common';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import { GeneralResponseDto } from 'src/common';
import { PrismaProvider } from '../providers';
// import { Asset } from './entities';

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
        return response;
      }
      const assets = await this.prisma.asset.findMany({ where: { userId } });

      response.code = 200;
      response.msg = 'Assets retrieved successfully';
      response.response = assets;
      return response;
    } catch (error) {
      console.error('Error fetching assets:', error);
      response.code = 500;
      response.msg = 'An error occurred while fetching assets';
      return response;
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
        return response;
      }
      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId },
      });

      if (!asset) {
        response.code = 404;
        response.msg = 'Asset not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Asset retrieved successfully';
      response.response = asset;
      return response;
    } catch (error) {
      console.error('Error fetching asset:', error);
      response.code = 500;
      response.msg = 'An error occurred while fetching the asset';
      return response;
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
        return response;
      }

      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        response.code = 400;
        response.msg = 'User does not exist';
        return response;
      }

      // Validar si la categoría existe
      const categoryExists = await this.prisma.assetCategory.findUnique({
        where: { id: createAssetDto.categoryId },
      });

      if (!categoryExists) {
        response.code = 400;
        response.msg =
          'Invalid asset category. The specified category does not exist.';
        return response;
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
      console.error('Error creating asset:', error);
      response.code = 500;
      response.msg = 'An error occurred while creating the asset';
      return response;
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
        return response;
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
      console.error('Error updating asset:', error);
      response.code = 500;
      response.msg = 'An error occurred while updating the asset';
      return response;
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
        return response;
      }
      await this.prisma.asset.delete({ where: { id: assetId } });

      response.code = 200;
      response.msg = 'Asset deleted successfully';
      return response;
    } catch (error) {
      console.error('Error deleting asset:', error);
      response.code = 500;
      response.msg = 'An error occurred while deleting the asset';
      return response;
    }
  }
}
