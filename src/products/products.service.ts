import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { CreateUserPartnerProductDto } from './dto/create-user-partner-product.dto';
import { UpdateUserPartnerProductDto } from './dto/update-user-partner-product.dto';

@Injectable()
export class ProductsService {
  private prisma: any = null;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async createUserProductSubscription(
    userId: string,
    dto: CreateUserPartnerProductDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dwpno8');

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user)
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);

      const service = await this.prisma.services.findFirst({
        where: { id: dto.serviceId, type: 'partnerProduct' },
      });
      if (!service)
        throw new HttpException('Service not Found', HttpStatus.BAD_REQUEST);

      const alreadyExists =
        await this.prisma.userPartnerProductContract.findFirst({
          where: { userId, serviceId: dto.serviceId },
        });

      if (alreadyExists) {
        throw new HttpException(
          'Subscription already exists',
          HttpStatus.CONFLICT,
        );
      }

      const record = await this.prisma.userPartnerProductContract.create({
        data: {
          userId,
          serviceId: dto.serviceId,
          metadata: dto.metadata,
          status: 'created',
          expireDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
        },
      });

      response.code = 201;
      response.msg = 'Partner product subscription created';
      response.response = record;
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async getUserProductsSubscriptions(
    userId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dnkd28');

      const records = await this.prisma.userPartnerProductContract.findMany({
        where: { userId },
        include: { service: true },
      });

      response.code = 200;
      response.msg = 'User subscriptions retrieved';
      response.response = records;
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async updateUserProductsSubscription(
    productId: string,
    dto: UpdateUserPartnerProductDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dsvbo8');

      const exists = await this.prisma.userPartnerProductContract.findUnique({
        where: { id: productId },
      });
      if (!exists)
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);

      const updated = await this.prisma.userPartnerProductContract.update({
        where: { id: productId },
        data: dto,
      });

      response.code = 200;
      response.msg = 'Partner product subscription updated';
      response.response = updated;
      return response;
    } catch (err) {
      processException(err);
    }
  }
}
