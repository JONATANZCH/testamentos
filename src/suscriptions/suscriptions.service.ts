import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { PPErrorManagementService } from '../config/ppErrorManagement.service';

@Injectable()
export class SuscriptionsService {
  private readonly logger = new Logger(SuscriptionsService.name);
  private prisma: any = null;

  constructor(
    private readonly prismaProvider: PrismaProvider,
    private readonly ppErrorMgmtService: PPErrorManagementService,
  ) {}

  async getServices(
    page: number,
    limit: number,
    country: string,
    type?: string,
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
      console.log('[getServices] Querying services...');

      const whereClause = {
        country,
        ...(type ? { type: { equals: type } } : {}),
      };

      const [services, total] = await Promise.all([
        this.prisma.services.findMany({
          where: whereClause,
          skip: offset,
          take: limitNumber,
        }),
        this.prisma.services.count({
          where: whereClause,
        }),
      ]);
      console.log(`[getServices] Query returned ${services.length} records`);

      if (total === 0 || !services) {
        console.log('[getServices] No subscriptions found');
        response.code = 404;
        response.msg = 'No subscriptions found for the specified country';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Para cada suscripción, obtenemos los precios asociados del catálogo de suscripciones
      const servicesWithPrices = await Promise.all(
        services.map(async (svc) => {
          const prices = await this.prisma.priceList.findMany({
            where: {
              serviceId: svc.id,
              country,
            },
            select: {
              id: true,
              currency: true,
              price: true,
              serviceId: true,
            },
          });
          return {
            ...svc,
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
        subscriptions: servicesWithPrices,
      };
      console.log('[getSubscriptions] Successfully retrieved subscriptions');
      return response;
    } catch (error) {
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
          orderBy: { suscriptionDate: 'desc' },
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

      const { userId, itemsPaid, amount } = payment;
      console.log(
        `[processPayment] payment received: ${JSON.stringify(payment)}`,
      );
      if (!userId || !itemsPaid) {
        console.log(
          '[processPaymentData] Missing userId or itemspaid in payment',
        );
      }

      console.log(
        `[processPayment] Procesando ${itemsPaid.length} ítem(es) en paymentId=${paymentId}`,
      );

      // 1. Validar que el monto cubra el costo total de todos los ítems
      let totalExpected = 0;

      for (const item of itemsPaid) {
        if (!item.serviceType) {
          console.error(
            `[processPayment] Ítem sin serviceType en paymentId=${paymentId}`,
          );
          throw new HttpException(
            { code: 400, msg: 'Service type not specified in payment item' },
            HttpStatus.BAD_REQUEST,
          );
        }

        // Buscar el precio del ítem en PriceList
        const priceRecord = await this.prisma.priceList.findFirst({
          where: {
            id: item.id,
          },
        });

        if (!priceRecord) {
          await this.prisma.servicesError.create({
            data: {
              paymentId,
              userId,
              message: `No price found in PriceList for id=${item.id}, serviceType=${item.serviceType}`,
              detail: item, // Guardamos el ítem como JSON
            },
          });
          throw new HttpException(
            {
              code: 404,
              msg: `Price not found for id=${item.id}, serviceType=${item.serviceType}`,
            },
            HttpStatus.NOT_FOUND,
          );
        }
        const quantity = item.quantity;
        const lineCost = priceRecord.price * quantity;

        totalExpected += lineCost;
      }

      console.log(
        `[processPayment] totalExpected=${totalExpected}, paymentAmount=${amount}`,
      );

      // 2. Verificar si el pago cubre el total
      if (amount < totalExpected) {
        await this.ppErrorMgmtService.sendLog({
          microsvc: 'Testamentos',
          process: 'Testamentos/processPaymentData',
          message: `Pago insuficiente: required=${totalExpected}, got=${amount}`,
          code: '',
          Idrelated: paymentId,
          level: 'error',
          metadata: { totalExpected, amount, items: itemsPaid },
        });
        await this.prisma.servicesError.create({
          data: {
            paymentId,
            userId,
            message: `Payment amount ${amount} is insufficient (required=${totalExpected})`,
            detail: { itemsPaid, totalExpected },
          },
        });
        throw new HttpException(
          {
            code: 400,
            msg: `Insufficient payment. Required=${totalExpected}, got=${amount}`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Si el monto es suficiente, crear las suscripciones/add-ons
      for (const item of itemsPaid) {
        switch (item.serviceType) {
          case 'subscription': {
            await this.prisma.usersSuscriptions.updateMany({
              where: {
                status: 'Active',
                expireDate: { lt: new Date() }, // Si expireDate es menor a la fecha actual, ha expirado
              },
              data: { status: 'Expired' },
            });
            // 1. Verificar si el usuario ya tiene una suscripción activa
            const activeSubscription =
              await this.prisma.usersSuscriptions.findFirst({
                where: {
                  userId: userId,
                  status: 'Active',
                  suscriptionType: item.id,
                },
              });

            if (activeSubscription) {
              await this.prisma.servicesError.create({
                data: {
                  paymentId,
                  userId,
                  message: `User already has an active subscription (id=${activeSubscription.id}). Cannot add another subscription.`,
                  detail: {
                    item,
                    existingSubscriptionId: activeSubscription.id,
                  },
                },
              });
              console.log(
                `[processPaymentData] User already has an active subscription (id=${activeSubscription.id}).`,
              );
              throw new HttpException(
                {
                  code: 400,
                  msg: `User already has an active subscription (id=${activeSubscription.id})`,
                },
                HttpStatus.BAD_REQUEST,
              );
            }

            // 2. Si no hay suscripción activa, se crea la nueva suscripción
            this.logger.log(
              `[processPaymentData] Creando suscripción para userId=${userId}`,
            );
            const newSubscription = await this.prisma.usersSuscriptions.create({
              data: {
                userId: userId,
                suscriptionType: item.id,
                status: 'Active',
                expireDate: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1),
                ),
                paymentId: payment.id,
              },
            });

            const service = await this.prisma.services.findUnique({
              where: { id: item.id },
            });

            if (service?.credits) {
              const creditEntries = Array(service.credits)
                .fill(null)
                .map(() => ({
                  userId,
                  type: 'subscription',
                  relatedId: newSubscription.id,
                  creditQuantity: 1,
                  status: 'New',
                  expirationDate: newSubscription.expireDate,
                }));
              await this.prisma.userCredits.createMany({ data: creditEntries });
            }
            break;
          }

          case 'addon': {
            await this.prisma.usersAddOns.updateMany({
              where: {
                status: 'Active',
                expireDate: { lt: new Date() }, // Si expireDate es menor a la fecha actual, ha expirado
              },
              data: { status: 'Expired' },
            });
            // 1. Verificar si el usuario ya tiene un add-on activo
            const activeAddon = await this.prisma.usersAddOns.findFirst({
              where: {
                userId: userId,
                status: 'Active',
                addOnType: item.id,
              },
            });

            if (activeAddon) {
              await this.prisma.servicesError.create({
                data: {
                  paymentId,
                  userId,
                  message: `User already has an active add-on (id=${activeAddon.id}). Cannot add another.`,
                  detail: { item, existingAddOnId: activeAddon.id },
                },
              });
              console.log(
                `[processPaymentData] User already has an active add-on (id=${activeAddon.id}).`,
              );
            }

            // 2. Crear el add-on si no hay uno activo
            this.logger.log(
              `[processPaymentData] Creando addon para userId=${userId}`,
            );
            const newAddon = await this.prisma.usersAddOns.create({
              data: {
                userId: userId,
                addOnType: item.id,
                status: 'Active',
                expireDate: new Date(
                  new Date().setFullYear(new Date().getFullYear() + 1),
                ),
                paymentId: payment.id,
              },
            });

            const service = await this.prisma.services.findUnique({
              where: { id: item.id },
            });
            if (service?.credits) {
              const creditEntries = Array(service.credits)
                .fill(null)
                .map(() => ({
                  userId,
                  type: 'addon',
                  relatedId: newAddon.id,
                  creditQuantity: 1,
                  status: 'New',
                  expirationDate: newAddon.expireDate,
                }));
              await this.prisma.userCredits.createMany({ data: creditEntries });
            }
            break;
          }

          case 'partner': {
            this.logger.log(
              `[processPaymentData] Creando partner product para userId=${userId}`,
            );
            console.log(
              `[processPaymentData] No hay manejo de lógica para partner products`,
            );
            break;
          }

          default:
            this.logger.error(
              `[processPaymentData] serviceType no soportado (${item.serviceType}) en paymentId=${paymentId}`,
            );
            await this.prisma.servicesError.create({
              data: {
                paymentId,
                userId,
                message: `Unsupported service type: ${item.serviceType}`,
              },
            });
            throw new HttpException(
              { code: 400, msg: 'Unsupported service type' },
              HttpStatus.BAD_REQUEST,
            );
            break;
        }
        console.log(
          `[processPayment] Ítem procesado exitosamente para paymentId=${paymentId}`,
        );
      }

      // 4. Actualizar el estado del pago a "Processed"
      // await this.prisma.payment.update({
      //   where: { id: paymentId },
      //   data: { status: 'Processed' },
      // });
      // console.log(
      //   `[processPayment] Estado actualizado a 'Processed' para paymentId=${paymentId}`,
      // );

      response.code = 200;
      response.msg = 'Payment processed successfully';
      response.response = payment;
      console.log(
        `[processPayment] Proceso completado para paymentId=${paymentId}`,
      );
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
