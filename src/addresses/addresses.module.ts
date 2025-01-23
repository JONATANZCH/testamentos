import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';

@Module({
  imports: [ConfigModule],
  controllers: [AddressesController],
  providers: [AddressesService, PrismaProvider, ConfigService],
})
export class AddressesModule {}
