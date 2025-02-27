import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config';
import { PrismaProvider } from '../providers';

@Module({
  imports: [ConfigModule],
  controllers: [AssetsController],
  providers: [AssetsService, PrismaProvider, ConfigService],
})
export class AssetsModule {}
