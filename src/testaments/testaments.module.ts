import { Module } from '@nestjs/common';
import { TestamentsService } from './testaments.service';
import { TestamentsController } from './testaments.controller';
import { ConfigService } from '../config';
import { PrismaProvider } from '../providers';

@Module({
  controllers: [TestamentsController],
  providers: [TestamentsService, ConfigService, PrismaProvider],
})
export class TestamentsModule {}
