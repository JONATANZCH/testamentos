import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TestamentsService } from './testaments.service';
import { TestamentsController } from './testaments.controller';
import { ConfigService } from '../config';
import { PrismaProvider } from '../providers';
import { SqsService } from '../config/sqs-validate.service';

@Module({
  imports: [HttpModule],
  controllers: [TestamentsController],
  providers: [TestamentsService, ConfigService, PrismaProvider, SqsService],
})
export class TestamentsModule {}
