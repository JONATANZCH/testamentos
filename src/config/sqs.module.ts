import { Module } from '@nestjs/common';
import { SqsService } from './sqs-validate.service';
import { HttpModule } from '@nestjs/axios';
import { SharedOperationsService } from './shared-operations.service';
import { ConfigService } from '../config';
import { PrismaProvider } from '../providers';

@Module({
  imports: [HttpModule],
  providers: [
    SqsService,
    ConfigService,
    SharedOperationsService,
    PrismaProvider,
  ],
  exports: [SqsService, SharedOperationsService],
})
export class SqsModule {}
