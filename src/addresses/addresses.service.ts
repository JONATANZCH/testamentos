import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { GeneralResponseDto } from 'src/common';
import { PrismaProvider } from 'src/providers';
import { Address } from './entities';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class AddressesService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;
  constructor(private prismaprovider: PrismaProvider) {
    this._prismaprovider = prismaprovider;
  }

  async getUserAddresses(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error-> cw"$d db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        response.code = 404;
        response.msg = 'User not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const addresses = await this.prisma.address.findMany({
        where: { userId },
      });

      if (!addresses || addresses.length === 0) {
        response.code = 404;
        response.msg = "You don't have any registered address";
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Addresses retrieved successfully';
      response.response = addresses;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAddressById(addressId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error->cec"d db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const address = await this.prisma.address.findFirst({
        where: { id: addressId },
      });

      if (!address) {
        response.code = 404;
        response.msg = 'Address not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Address retrieved successfully';
      response.response = address;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createUserAddress(
    userId: string,
    addressDto: CreateAddressDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error->wcc[] db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const userExists = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        response.code = 404;
        response.msg = 'User not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const address: Address = await this.prisma.address.create({
        data: { userId, ...addressDto },
      });

      response.code = 201;
      response.msg = 'Address created successfully';
      response.response = address;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateAddress(
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error->dw$sa db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const addressExists = await this.prisma.address.findFirst({
        where: { id: addressId },
      });

      if (!addressExists) {
        response.code = 404;
        response.msg = 'Address not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const address: Address = await this.prisma.address.update({
        where: { id: addressId },
        data: updateAddressDto,
      });

      response.code = 200;
      response.msg = 'Address updated successfully';
      response.response = address;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async deleteAddress(addressId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Testament Error->dwdw& db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const addressExists = await this.prisma.address.findFirst({
        where: { id: addressId },
      });

      if (!addressExists) {
        response.code = 404;
        response.msg = 'Address not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      const address: Address = await this.prisma.address.delete({
        where: { id: addressId },
      });

      response.code = 200;
      response.msg = `Address ${address} deleted successfully`;
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
