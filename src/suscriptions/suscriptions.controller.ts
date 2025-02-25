import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SuscriptionsService } from './suscriptions.service';
import { ConfigService } from '../config';
import { GeneralResponseDto, PaginationDto } from '../common';

@Controller()
export class SuscriptionsController {
  private readonly environment: string;

  constructor(
    private readonly suscriptionsService: SuscriptionsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/payments';
    Reflect.defineMetadata('path', this.environment, SuscriptionsController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Get('/catalog/subscriptions')
  async getSubscriptions(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    const { page, limit, country } = paginationDto;
    if (!country) {
      throw new HttpException(
        { code: 400, msg: 'country parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    console.log('[catalog/subscriptions] Getting all subscriptions');
    return this.suscriptionsService.getSubscriptions(page, limit, country);
  }

  @Get('/:userId/subscriptions')
  async getUserSubscriptions(
    @Query() paginationDto: PaginationDto,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[getSubscriptions] userId=${userId}`);
    const { page, limit } = paginationDto;
    return this.suscriptionsService.getUserSubscriptions(userId, page, limit);
  }

  @Get('/subscription/:paymentId')
  async getSuscriptionById(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[getSuscriptionById] paymentId=${paymentId}`);
    return this.suscriptionsService.getSuscriptionById(paymentId);
  }

  @Get('/catalog/addons')
  async getAllAddOns(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    const { page, limit, country } = paginationDto;
    if (!country) {
      throw new HttpException(
        { code: 400, msg: 'country parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    console.log('[catalog/addons] Getting all add-ons');
    return this.suscriptionsService.getAllAddOns(page, limit, country);
  }

  @Post('/processPayment/:paymentId')
  async processPayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() body: any,
  ): Promise<GeneralResponseDto> {
    console.log(
      `[processPayment] Recibido request para paymentId=${paymentId}, body=${JSON.stringify(body)}`,
    );
    return this.suscriptionsService.processPaymentData(paymentId, body.payment);
  }
}
