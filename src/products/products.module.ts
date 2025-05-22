import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';
import { SqsModule } from '../config/sqs.module';

@Module({
  imports: [SqsModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaProvider, ConfigService],
})
export class ProductsModule {}
