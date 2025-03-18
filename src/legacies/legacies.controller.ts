import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Put,
} from '@nestjs/common';
import { LegaciesService } from './legacies.service';
import { CreateLegacyDto, UpdateLegacyDto } from './dto';
import { PaginationDto, GeneralResponseDto } from '../common';
import { ConfigService } from '../config';

@Controller('wills')
export class LegaciesController {
  private readonly environment: string;

  constructor(
    private readonly legaciesService: LegaciesService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, LegaciesController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post('/testaments/:testamentId/legacies')
  async createLegacy(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() createLegacyDto: CreateLegacyDto,
  ): Promise<GeneralResponseDto> {
    console.log('[LegaciesController] createLegacy, entering...');
    return this.legaciesService.createLegacy(testamentId, createLegacyDto);
  }

  @Get('/testaments/:testamentId/legacies')
  async getAllLegaciesByTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log('[LegaciesController] getAllLegaciesByTestament, entering...');
    const { page, limit } = paginationDto;
    return this.legaciesService.getAllLegaciesByTestament(
      testamentId,
      page,
      limit,
    );
  }

  @Get('/legacies/:legacyId')
  async getLegacyById(
    @Param('legacyId', ParseUUIDPipe) legacyId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[LegaciesController] getLegacyById, entering...');
    return this.legaciesService.getLegacyById(legacyId);
  }

  @Put('/legacies/:legacyId')
  async updateLegacy(
    @Param('legacyId', ParseUUIDPipe) legacyId: string,
    @Body() updateLegacyDto: UpdateLegacyDto,
  ): Promise<GeneralResponseDto> {
    console.log('[LegaciesController] updateLegacy, entering...');
    return this.legaciesService.updateLegacy(legacyId, updateLegacyDto);
  }

  @Delete('/legacies/:legacyId')
  async deleteLegacy(
    @Param('legacyId', ParseUUIDPipe) legacyId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[LegaciesController] deleteLegacy, entering...');
    return this.legaciesService.deleteLegacy(legacyId);
  }
}
