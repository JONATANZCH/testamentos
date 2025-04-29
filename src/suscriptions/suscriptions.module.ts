import { Module } from '@nestjs/common';
import { SuscriptionsService } from './suscriptions.service';
import { SuscriptionsController } from './suscriptions.controller';
import { PrismaProvider } from 'src/providers';
import { ConfigService } from '../config';
import { PPErrorManagementService } from '../config/ppErrorManagement.service';
import { SqsService } from '../config/sqs-validate.service';

@Module({
  controllers: [SuscriptionsController],
  providers: [
    SuscriptionsService,
    PrismaProvider,
    ConfigService,
    PPErrorManagementService,
    SqsService,
  ],
})
export class SuscriptionsModule {}
