import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SuscriptionsService } from './suscriptions.service';
import { ConfigService } from '../config';
import { GeneralResponseDto } from '../common';
import { GetCreditQueryDto } from '../common/dto/credit.dto';

@Controller('suscriptions')
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

  @Get('/:userId/subscriptions')
  async getUserSubscriptions(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[getSubscriptions] userId=${userId}`);
    return this.suscriptionsService.getUserSubscriptions(userId);
  }

  @Get('/:paymentId')
  async getSuscriptionById(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[getSuscriptionById] paymentId=${paymentId}`);
    return this.suscriptionsService.getSuscriptionById(paymentId);
  }

  @Get('/credit/:creditId')
  async getCreditById(
    @Param('creditId') creditId: string,
    @Query() query: GetCreditQueryDto,
  ): Promise<GeneralResponseDto> {
    console.log(
      `[getCreditById] creditId=${creditId} query=${JSON.stringify(query)}`,
    );
    return this.suscriptionsService.getCreditById(creditId, query.type);
  }

  @Get('/catalog/subscriptions')
  async getAllSubscriptions(): Promise<GeneralResponseDto> {
    console.log('[catalog/subscriptions] Getting all subscriptions');
    return this.suscriptionsService.getAllSubscriptions();
  }

  @Get('/catalog/addons')
  async getAllAddOns(): Promise<GeneralResponseDto> {
    console.log('[catalog/addons] Getting all add-ons');
    return this.suscriptionsService.getAllAddOns();
  }
}
