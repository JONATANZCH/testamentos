import { Module } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { ExecutorController } from './executor.controller';
import { PrismaProvider } from '../providers';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config';

@Module({
  imports: [ConfigModule],
  controllers: [ExecutorController],
  providers: [ExecutorService, ConfigService, PrismaProvider],
})
export class ExecutorModule {}
