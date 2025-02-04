import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { LegalEntitiesService } from './legal-entities.service';
import { GeneralResponseDto, PaginationDto } from '../common';
import { ConfigService } from '../config';

@Controller('wills/legalentities')
export class LegalEntitiesController {
  private readonly environment: string;

  constructor(
    private readonly legalEntitiesService: LegalEntitiesService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/legalentities';
    Reflect.defineMetadata('path', this.environment, LegalEntitiesController);
    console.log('Version - 20250130 12:00pm');
    console.log('Environment running -> ' + this.environment);
  }

  @Get()
  async getLegalEntities(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log('Get legal entities request received');
    const { page, limit } = paginationDto;
    return this.legalEntitiesService.getLegalEntities(page, limit);
  }

  @Get('/:id')
  async getLegalEntityById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get legal entity by id request received');
    return this.legalEntitiesService.getLegalEntityById(id);
  }
}
