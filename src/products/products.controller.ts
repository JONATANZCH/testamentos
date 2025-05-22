import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ConfigService } from '../config';
import { GeneralResponseDto } from '../common/response.dto';
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
  ): Promise<GeneralResponseDto> {
    console.log(`[createUserProductSubscription] userId=${userId}`);
    return this.productsService.createUserProductSubscription(userId, dto);
  }

  @Patch('/:contractId/products')
  updateUserProductsSubscription(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: UpdateUserPartnerProductDto,
  ): Promise<GeneralResponseDto> {
    console.log(`[updateUserProductsSubscription] contractId=${contractId}`);
    return this.productsService.updateUserProductsSubscription(contractId, dto);
  }

  @Post('/:contractId/signProductContract')
  async signProductContract(
    @Param('contractId', ParseUUIDPipe) contractId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[signProductContract] contractId=${contractId}`);
    return this.productsService.signProductContract(contractId);
  }
}
