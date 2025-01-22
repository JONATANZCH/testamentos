import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers/prisma-provider/prisma-provider';
import { CreateAddressDto, CreateUserDto, UpdateUserDto } from './dto';
import { GeneralResponseDto } from '../common';

@Injectable()
export class UsersService {
  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getAllUsers(page: number, limit: number): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      const offset = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count(),
      ]);

      response.code = 200;
      response.msg = 'Users retrieved successfully';
      response.response = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        users,
      };
      return response;
    } catch (error) {
      console.error('Error fetching users:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching users';
      return response;
    }
  }

  async create(createUserDto: CreateUserDto): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        return response;
      }

      const user = await prisma.user.create({ data: createUserDto });

      response.code = 201;
      response.msg = 'User created successfully';
      response.response = user;
      return response;
    } catch (error) {
      console.log('Error creating user:', error);
      if (error.code === 'P2002' && error.meta?.target === 'User_email_key') {
        response.code = 409;
        response.msg = 'A user with this email already exists';
        return response;
      }

      response.code = 500;
      response.msg = 'An unexpected error occurred while creating the user';
      return response;
    }
  }

  async findById(id: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> xw7q');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        return response;
      }

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        response.code = 404;
        response.msg = `User with id ${id} not found`;
        return response;
      }

      response.code = 200;
      response.msg = 'User retrieved successfully';
      response.response = user;
      return response;
    } catch (error) {
      console.log('Error fetching user by id:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching the user';
      return response;
    }
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> decbj4 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      if (updateUserDto.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: updateUserDto.email,
            NOT: { id },
          },
        });

        console.log('Existing user for email check:', existingUser);

        if (existingUser) {
          response.code = 409;
          response.msg = `A user with email ${updateUserDto.email} already exists`;
          return response;
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateUserDto,
      });

      response.code = 200;
      response.msg = 'User updated successfully';
      response.response = user;
      return response;
    } catch (error) {
      console.log('Error updating user:', error);
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = `User with id ${id} not found`;
        return response;
      }
      response.code = 500;
      response.msg = 'An unexpected error occurred while updating the user';
      return response;
    }
  }

  async deleteUserPermanently(id: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      const user = await prisma.user.delete({
        where: { id },
      });

      response.code = 200;
      response.msg = 'User permanently deleted successfully';
      response.response = user;
      return response;
    } catch (error) {
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = `User with id ${id} not found`;
        return response;
      }

      console.error('Unexpected error deleting user permanently:', error);
      response.code = 500;
      response.msg =
        'An unexpected error occurred while deleting the user permanently';
      return response;
    }
  }

  async getUserAddresses(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaProvider.getPrismaClient();
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
      const address = await prisma.address.create({
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
}
