import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';

@Module({
  controllers: [PetsController],
  providers: [PetsService, PrismaProvider, ConfigService],
})
export class PetsModule {}
