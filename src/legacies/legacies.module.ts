import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LegaciesService } from './legacies.service';
import { PrismaProvider } from '../providers';
import { LegaciesController } from './legacies.controller';
import { ConfigService } from '../config';

@Module({
  imports: [ConfigModule],
  controllers: [LegaciesController],
  providers: [LegaciesService, PrismaProvider, ConfigService],
})
export class LegaciesModule {}
