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

  async processPaymentData(
    paymentId: string,
    payment: any,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      console.log(
        `[processPayment] Iniciando procesamiento para paymentId=${paymentId}`,
      );

      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('[processPayment] Prisma client is null');
        response.code = 500;
        response.msg = 'Could not connect to the database (prisma is null)';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      console.log(
        `[processPayment] Cliente Prisma obtenido para paymentId=${paymentId}`,
      );

      const { userId, itemspaid, methodpayment, currency, amount } = payment;
      if (!userId || !itemspaid) {
        this.logger.error(
          '[processPaymentData] Missing userId or itemspaid in payment',
        );
        throw new HttpException(
          { code: 400, msg: 'Invalid payment data' },
          HttpStatus.BAD_REQUEST,
        );
      }
      console.log(
        `[processPayment] Procesando ${payment.itemspaid.length} ítem(es) en paymentId=${paymentId}`,
      );
      for (const item of itemspaid) {
        console.log(
          `[processPayment] Procesando ítem: ${JSON.stringify(item)}`,
        );
        if (!item.servicetype) {
          console.error(
            `[processPayment] Ítem sin servicetype en paymentId=${paymentId}`,
          );
          throw new HttpException(
            { code: 400, msg: 'Service type not specified in payment item' },
            HttpStatus.BAD_REQUEST,
          );
        }

        switch (item.servicetype) {
          case 'subscription':
            this.logger.log(
              `[processPaymentData] Creando suscripción para userId=${userId}`,
            );
            await this.prisma.usersSuscriptions.create({
              data: {
                userId: userId,
                suscriptionType: item.id, // item.id es el ID del catálogo de suscripciones
                paymentDate: payment.paymentDate || new Date(),
                expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Ejemplo: 30 días
                paymentGateway: methodpayment,
                paymentAmount: amount,
                currency: currency,
                paymentId: payment.id,
              },
            });
            break;

          case 'addon':
            this.logger.log(
              `[processPaymentData] Creando addon para userId=${userId}`,
            );
            await this.prisma.usersAddOns.create({
              data: {
                userId: userId,
                addOnType: item.id,
                paymentDate: payment.paymentDate || new Date(),
                expireDate: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1),
                ), // 1 año
                paymentGateway: methodpayment,
                paymentAmount: amount,
                currency: currency,
                paymentId: payment.id,
              },
            });
            break;

          case 'partner':
            this.logger.log(
              `[processPaymentData] Creando partner product para userId=${userId}`,
            );
            await this.prisma.usersPartnerProduct.create({
              data: {
                userId: userId,
                partnerProductId: item.id,
                serviceType: 'partner',
                paymentDate: payment.paymentDate || new Date(),
                expireDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 días
                paymentGateway: methodpayment,
                paymentAmount: amount,
                currency: currency,
                paymentId: payment.id,
              },
            });
            break;

          default:
            this.logger.error(
              `[processPaymentData] servicetype no soportado (${item.servicetype}) en paymentId=${paymentId}`,
            );
            throw new HttpException(
              { code: 400, msg: 'Unsupported service type' },
              HttpStatus.BAD_REQUEST,
            );
        }
        console.log(
          `[processPayment] Ítem procesado exitosamente para paymentId=${paymentId}`,
        );
      }

      // Actualizar el estado del pago a "Processed"
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'Processed' },
      });
      console.log(
        `[processPayment] Estado actualizado a 'Processed' para paymentId=${paymentId}`,
      );

      response.code = 200;
      response.msg = 'Payment processed successfully';
      response.response = payment;
      console.log(
        `[processPayment] Proceso completado para paymentId=${paymentId}`,
      );
      return response;
    } catch (error) {
      console.error(
        `[processPayment] Error en procesamiento para paymentId=${paymentId}:`,
        error,
      );
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { code: 500, msg: 'Internal error processing payment' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
