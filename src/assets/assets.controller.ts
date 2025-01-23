import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './dto';
import { GeneralResponseDto } from 'src/common';

@Controller()
export class AssetsController {
  private readonly environment: string;

  constructor(private readonly assetsService: AssetsService) {}

  @Get('/user/:userId/assets')
  async getUserAssets(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user assets request received');
    return this.assetsService.getUserAssets(userId);
  }

  @Get('/user/:userId/asset/:assetId')
  async getAssetById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get asset by id request received');
    return this.assetsService.getAssetById(userId, assetId);
  }

  @Post('/user/:userId/asset')
  async createAsset(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createAssetDto: CreateAssetDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create asset request received');
    return this.assetsService.createAsset(userId, createAssetDto);
  }

  @Put('/user/:userId/asset/:assetId')
  async updateAsset(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update asset request received');
    return this.assetsService.updateAsset(userId, assetId, updateAssetDto);
  }

  @Delete('/user/:userId/asset/:assetId')
  async deleteAsset(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Delete asset request received');
    return this.assetsService.deleteAsset(userId, assetId);
  }
}
