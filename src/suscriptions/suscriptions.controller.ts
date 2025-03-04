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

@Controller('wills/payments')
export class SuscriptionsController {
  private readonly environment: string;

  constructor(
    private readonly suscriptionsService: SuscriptionsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/payments';
    Reflect.defineMetadata('path', this.environment, SuscriptionsController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Get('/catalog/services')
  async getSubscriptions(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    const { page, limit, country, type } = paginationDto;
    if (!country) {
      throw new HttpException(
        { code: 400, msg: 'country parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    console.log('[catalog/services] Getting all services');
    return this.suscriptionsService.getServices(page, limit, country, type);
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
