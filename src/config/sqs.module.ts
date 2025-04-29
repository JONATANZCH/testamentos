import { Module } from '@nestjs/common';
import { SqsService } from './sqs-validate.service';
import { ConfigService } from '../config';

@Module({
  providers: [SqsService, ConfigService],
  exports: [SqsService],
})
export class SqsModule {}
