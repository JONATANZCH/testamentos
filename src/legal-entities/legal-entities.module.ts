import { Module } from '@nestjs/common';
import { LegalEntitiesService } from './legal-entities.service';
import { LegalEntitiesController } from './legal-entities.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';

@Module({
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService, PrismaProvider, ConfigService],
})
export class LegalEntitiesModule {}
