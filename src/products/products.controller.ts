import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  Get,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ConfigService } from '../config';
import { GeneralResponseDto } from '../common/response.dto';
import { CreateUserPartnerProductDto } from './dto/create-user-partner-product.dto';
import { UpdateUserPartnerProductDto } from './dto/update-user-partner-product.dto';
import { PaginationDto } from '../common';
import { CreateSignPdfDto } from '../common/dto/create-sign-pdf.dto';

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

  @Get('/:userId/allProducts')
  async getAllProducts(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log(`[getAllProducts] userId=${userId}`);
    const { page, limit } = paginationDto;
    return this.productsService.getAllProducts(userId, page, limit);
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

  @Post('/sign')
  async signPdf(@Body() body: CreateSignPdfDto): Promise<GeneralResponseDto> {
    console.log(`[signPdf] dto=${JSON.stringify(body)}`);
    return this.productsService.signPdf(body);
  }
}
