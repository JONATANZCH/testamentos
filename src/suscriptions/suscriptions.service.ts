import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class SuscriptionsService {
  private readonly logger = new Logger(SuscriptionsService.name);
  private prisma: any = null;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getSubscriptions(
    page: number,
    limit: number,
    country: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('[getSubscriptions] Prisma client is null');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      console.log('[getSubscriptions] Prisma client obtained successfully');

      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);
      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;
      console.log('[getSubscriptions] Querying suscriptionsCatalogue...');

      const [subs, total] = await Promise.all([
        this.prisma.suscriptionsCatalogue.findMany({
          where: { country },
          skip: offset,
          take: limitNumber,
        }),
        this.prisma.suscriptionsCatalogue.count({
          where: { country },
        }),
      ]);
      console.log(`[getSubscriptions] Query returned ${subs.length} records`);

      if (total === 0 || !subs) {
        console.log('[getSubscriptions] No subscriptions found');
        response.code = 404;
        response.msg = 'No subscriptions found for the specified country';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Para cada suscripción, obtenemos los precios asociados del catálogo de suscripciones
      const subscriptionsWithPrices = await Promise.all(
        subs.map(async (sub) => {
          const prices = await this.prisma.priceList.findMany({
            where: {
              catalogId: sub.suscriptionType,
              catalogType: 'suscriptions',
              country,
            },
            select: {
              priceId: true,
              currency: true,
              price: true,
            },
          });
          return {
            ...sub,
            pricelist: prices,
          };
        }),
      );

      response.code = 200;
      response.msg = 'Subscriptions retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        subscriptions: subscriptionsWithPrices,
      };
      console.log('[getSubscriptions] Successfully retrieved subscriptions');
      return response;
    } catch (error) {
      this.logger.error('[getAllSubscriptions] Error occurred', error);
      processException(error);
    }
  }

  async getUserSubscriptions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<GeneralResponseDto> {
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

      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);
      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;
      console.log(
        `[getUserSubscriptions] Querying suscriptions for userId=${userId}...`,
      );
      const [subs, total] = await Promise.all([
        this.prisma.usersSuscriptions.findMany({
          where: { userId },
          skip: offset,
          take: limitNumber,
          orderBy: { paymentDate: 'desc' },
        }),
        this.prisma.usersSuscriptions.count({
          where: { userId },
        }),
      ]);
      console.log(
        `[getUserSubscriptions] Query returned ${subs.length} records`,
      );

      if (total === 0) {
        console.log('[getUserSubscriptions] No subscriptions found');
        response.code = 404;
        response.msg = 'No subscriptions found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Subscriptions retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        subscriptions: subs,
      };
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
      const payment = await this.prisma.usersSuscriptions.findMany({
        where: { paymentId: paymentId },
      });

      if (payment.length === 0 || !payment) {
        console.log('[getpay] Payment not found');
        response.code = 404;
        response.msg = 'Payment not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Payment retrieved successfully';
      response.response = payment[0];
      console.log('[getpay] Payment retrieved successfully');
      return response;
    } catch (error) {
      console.log('[getSuscriptionById] Error:' + error);
      processException(error);
    }
  }

  async getAllAddOns(
    page: number,
    limit: number,
    country: string,
  ): Promise<GeneralResponseDto> {
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

      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);
      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;
      console.log('[getAllAddOns] Querying addOnsCatalogue...');
      const [addOns, total] = await Promise.all([
        this.prisma.addOnsCatalogue.findMany({
          where: { country },
          skip: offset,
          take: limitNumber,
        }),
        this.prisma.addOnsCatalogue.count({
          where: { country },
        }),
      ]);
      console.log(`[getAllAddOns] Query returned ${addOns.length} records`);

      if (total === 0 || !addOns) {
        console.log('[getAllAddOns] No add-ons found');
        response.code = 404;
        response.msg = 'No add-ons found for the specified country';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const addOnsWithPrices = await Promise.all(
        addOns.map(async (addOn) => {
          const prices = await this.prisma.priceList.findMany({
            where: {
              catalogId: addOn.addOnType,
              catalogType: 'addOns',
              country,
            },
            select: {
              priceId: true,
              currency: true,
              price: true,
            },
          });
          return {
            ...addOn,
            pricelist: prices,
          };
        }),
      );

      response.code = 200;
      response.msg = 'Add-ons retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        addOns: addOnsWithPrices,
      };
      console.log('[getAllAddOns] Successfully retrieved add-ons');
      return response;
    } catch (error) {
      this.logger.error('[getAllAddOns] Error occurred', error);
      processException(error);
    }
  }

  async processPayment(paymentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) {
        throw new HttpException(
          { code: 404, msg: 'Payment not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (payment.status !== 'QueueSuscription') {
        throw new HttpException(
          { code: 400, msg: 'Payment not queued for processing' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Procesar cada ítem en el campo itemspaid
      for (const item of payment.itemspaid) {
        if (!item.servicetype) {
          throw new HttpException(
            { code: 400, msg: 'Service type not specified in payment item' },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (item.servicetype === 'subscription') {
          await this.prisma.usersSuscriptions.create({
            data: {
              userId: payment.userId,
              suscriptionType: item.id, // 'item.id' corresponde al ID del catálogo?
              paymentDate: payment.paymentDate,
              expireDate: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(), // Ejemplo: 30 días de suscripción
              paymentGateway: payment.methodpayment,
              paymentAmount: payment.amount,
              currency: payment.currency,
              paymentId: payment.id,
            },
          });
        } else if (item.servicetype === 'addon') {
          await this.prisma.usersAddOns.create({
            data: {
              userId: payment.userId,
              addOnType: item.id,
              paymentDate: payment.paymentDate,
              expireDate: new Date(
                new Date().setFullYear(new Date().getFullYear() + 1),
              ).toISOString(), // Ejemplo: 1 año
              paymentGateway: payment.methodpayment,
              paymentAmount: payment.amount,
              currency: payment.currency,
              paymentId: payment.id,
            },
          });
        } else if (item.servicetype === 'partner') {
          await this.prisma.usersPartnerProduct.create({
            data: {
              userId: payment.userId,
              partnerProductId: item.id,
              serviceType: 'partner',
              paymentDate: payment.paymentDate,
              expireDate: new Date(
                Date.now() + 90 * 24 * 60 * 60 * 1000,
              ).toISOString(), // Ejemplo: 90 días
              paymentGateway: payment.methodpayment,
              paymentAmount: payment.amount,
              currency: payment.currency,
              paymentId: payment.id,
            },
          });
        } else {
          throw new HttpException(
            { code: 400, msg: 'Unsupported service type' },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'Processed' },
      });
      response.code = 200;
      response.msg = 'Payment processed successfully';
      response.response = payment;
      return response;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { code: 500, msg: 'Internal error processing payment' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
