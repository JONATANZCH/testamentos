import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { creditSearchbyEnum } from '../common/dto/credit-search.enum';

@Injectable()
export class SuscriptionsService {
  private readonly logger = new Logger(SuscriptionsService.name);
  private prisma: any = null;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserSubscriptions(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('[getUserSubscriptions] Prisma client is null');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      console.log('[getUserSubscriptions] Prisma client obtained successfully');

      console.log(
        `[getUserSubscriptions] Querying suscriptions for userId=${userId}...`,
      );
      const subs = await this.prisma.payment.findMany({
        where: {
          userId,
        },
      });
      console.log(
        `[getUserSubscriptions] Query returned ${subs.length} records`,
      );

      if (!subs || subs.length === 0) {
        console.log('[getUserSubscriptions] No subscriptions found');
        response.code = 404;
        response.msg = 'No subscriptions found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Subscriptions retrieved successfully';
      response.response = subs;
      console.log(
        '[getUserSubscriptions] Successfully retrieved subscriptions',
      );
      return response;
    } catch (error) {
      this.logger.error('[getUserSubscriptions] Error occurred', error);
      processException(error);
    }
  }

  async getSuscriptionById(paymentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (this.prisma == null) {
        console.log('[getpay] Could not connect to DB (prisma is null)');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const payment = await this.prisma.payment.findMany({
        where: { id: paymentId },
      });
      switch (payment.length) {
        case 0:
          response.code = 404;
          response.msg = 'No payment found';
          break;
        case 1:
          response.code = 200;
          response.msg = 'Ok';
          response.response = payment;
          break;
        default:
          // Handle other cases if needed
          response.code = 500;
          response.msg = 'Wierd case error';
          response.response = null;
          break;
      }
      return response;
    } catch (error) {
      console.log('Error getting info form DB getpay', error);
      console.log('Paspost Error-> d83hg98(20sh');
      response.code = 500;
      response.msg = 'error code d83hg98(20sh';
      return response;
    }
  }

  async getCreditById(
    creditId: string,
    _type: string,
    searchby?: creditSearchbyEnum,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    console.log('we are in getCredit _type:' + searchby);
    try {
      if (searchby === undefined) {
        console.log('searchby is undefined setting to default code');
        searchby = creditSearchbyEnum.code;
      }

      let wherestatement = {};
      switch (searchby) {
        case creditSearchbyEnum.code:
          wherestatement = { code: creditId };
          break;
        case creditSearchbyEnum.token:
          wherestatement = { token: creditId };
          break;
        case creditSearchbyEnum.id:
          wherestatement = { id: creditId };
          break;

        default:
          console.log('searchby not found');
          break;
      }

      const type = _type.toLowerCase(); // type is for future usage to redirect to another table if needed
      console.log('get Credit: type:' + type);
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (this.prisma == null) {
        console.log('[getCredit] Could not connect to DB (prisma is null)');
        response.code = 400;
        response.msg = 'No token found in body';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }
      const credit = await this.prisma.credits.findUniqueOrThrow({
        where: wherestatement,
        select: {
          id: true,
          code: true,
          token: true,
          expirationDate: true,
          metadata: true,
          status: true,
          assignation: true,
          type: true,
        },
      });
      if (credit === null) {
        console.log('No credit found for ' + creditId);
        response.code = 404;
        response.msg = 'No credit found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      response.code = 200;
      response.msg = 'Ok';
      response.response = credit;
      console.log('credit found:' + JSON.stringify(credit));
      return response;
    } catch (error) {
      console.log('error getting credit:' + error);
      processException(error);
    }
  }

  async getAllSubscriptions(): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('[getAllSubscriptions] Prisma client is null');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      console.log('[getAllSubscriptions] Prisma client obtained successfully');

      console.log('[getAllSubscriptions] Querying suscriptionsCatalogue...');
      const subsCatalog = await this.prisma.suscriptionsCatalogue.findMany();
      console.log(
        `[getAllSubscriptions] Query returned ${subsCatalog.length} records`,
      );

      if (!subsCatalog || subsCatalog.length === 0) {
        console.log('[getAllSubscriptions] No subscription catalog found');
        response.code = 404;
        response.msg = 'No subscription catalog found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Subscriptions catalog retrieved successfully';
      response.response = subsCatalog;
      console.log(
        '[getAllSubscriptions] Successfully retrieved subscriptions catalog',
      );
      return response;
    } catch (error) {
      this.logger.error('[getAllSubscriptions] Error occurred', error);
      processException(error);
    }
  }

  async getAllAddOns(): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('[getAllAddOns] Prisma client is null');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      console.log('[getAllAddOns] Prisma client obtained successfully');

      console.log('[getAllAddOns] Querying addOnsCatalogue...');
      const addonsCatalog = await this.prisma.addOnsCatalogue.findMany();
      console.log(
        `[getAllAddOns] Query returned ${addonsCatalog.length} records`,
      );

      if (!addonsCatalog || addonsCatalog.length === 0) {
        console.log('[getAllAddOns] No add-ons catalog found');
        response.code = 404;
        response.msg = 'No add-ons catalog found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Add-ons catalog retrieved successfully';
      response.response = addonsCatalog;
      console.log('[getAllAddOns] Successfully retrieved add-ons catalog');
      return response;
    } catch (error) {
      this.logger.error('[getAllAddOns] Error occurred', error);
      processException(error);
    }
  }
}
