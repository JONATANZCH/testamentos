import { Module } from '@nestjs/common';
import { SuscriptionsService } from './suscriptions.service';
import { SuscriptionsController } from './suscriptions.controller';
import { PrismaProvider } from 'src/providers';
import { ConfigService } from '../config';

@Module({
  controllers: [SuscriptionsController],
  providers: [SuscriptionsService, PrismaProvider, ConfigService],
})
export class SuscriptionsModule {}
