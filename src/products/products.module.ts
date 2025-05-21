import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaProvider, ConfigService],
})
export class ProductsModule {}
