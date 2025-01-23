import { Injectable } from '@nestjs/common';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { GeneralResponseDto } from 'src/common';
import { PrismaProvider } from 'src/providers';
import { Address } from './entities';

@Injectable()
export class AddressesService {
  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserAddresses(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Testament Error-> cw"$d db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      const addresses = await prisma.address.findMany({ where: { userId } });

      response.code = 200;
      response.msg = 'Addresses retrieved successfully';
      response.response = addresses;
      return response;
    } catch (error) {
      console.error('Error fetching addresses:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching addresses';
      return response;
    }
  }

  async getAddressById(
    userId: string,
    addressId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Testament Error->cec"d db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      const address = await prisma.address.findFirst({
        where: { userId, id: addressId },
      });

      if (!address) {
        response.code = 404;
        response.msg = 'Address not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Address retrieved successfully';
      response.response = address;
      return response;
    } catch (error) {
      console.error('Error fetching address by ID:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching the address';
      return response;
    }
  }

  async createUserAddress(
    userId: string,
    addressDto: CreateAddressDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Testament Error->wcc[] db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      const address: Address = await prisma.address.create({
        data: { userId, ...addressDto },
      });

      response.code = 201;
      response.msg = 'Address created successfully';
      response.response = address;
      return response;
    } catch (error) {
      console.error('Error creating address:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while creating the address';
      return response;
    }
  }

  async updateAddress(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Testament Error->dw$sa db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      const address: Address = await prisma.address.update({
        where: { userId, id: addressId },
        data: updateAddressDto,
      });

      response.code = 200;
      response.msg = 'Address updated successfully';
      response.response = address;
      return response;
    } catch (error) {
      console.error('Error updating address:', error);
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = 'Address not found';
        return response;
      }
      response.code = 500;
      response.msg = 'An unexpected error occurred while updating the address';
      return response;
    }
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Testament Error->dwdw& db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }
      const address: Address = await prisma.address.delete({
        where: { userId, id: addressId },
      });

      response.code = 200;
      response.msg = `Address ${address} deleted successfully`;
      return response;
    } catch (error) {
      console.error('Error deleting address:', error);
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = 'Address not found';
        return response;
      }
      response.code = 500;
      response.msg = 'An unexpected error occurred while deleting the address';
      return response;
    }
  }
}
