import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ConfigService } from '../config';
import { CreateUserPartnerProductDto } from './dto/create-user-partner-product.dto';
import { UpdateUserPartnerProductDto } from './dto/update-user-partner-product.dto';

@Controller('wills')
export class ProductsController {
  private readonly environment: string;

  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, ProductsController);
    console.log('Version - 20250521 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post('/:userId/products')
  createUserProductSubscription(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateUserPartnerProductDto,
  ) {
    return this.productsService.createUserProductSubscription(userId, dto);
  }

  @Get('/:userId/products')
  getUserProductsSubscriptions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.productsService.getUserProductsSubscriptions(userId);
  }

  @Patch('/:productId/products')
  updateUserProductsSubscription(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateUserPartnerProductDto,
  ) {
    return this.productsService.updateUserProductsSubscription(productId, dto);
  }
}
