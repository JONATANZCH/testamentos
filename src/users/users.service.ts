import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateUserDto, UpdateUserDto } from './dto';
import { GeneralResponseDto } from '../common';
import { reverseCountryPhoneCodeMap } from '../common/utils/reverseCountryPhoneCodeMap';

@Injectable()
export class UsersService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;

  constructor(private prismaprovider: PrismaProvider) {
    this._prismaprovider = prismaprovider;
  }

  async getAllUsers(page: number, limit: number): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      // Convert page and limit to integers
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        return response;
      }

      const offset = (pageNumber - 1) * limitNumber;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          skip: offset,
          take: limitNumber,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count(),
      ]);

      if (users.countryCode) {
        users.countryCode = reverseCountryPhoneCodeMap[users.countryCode];
      }

      response.code = 200;
      response.msg = 'Users retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
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

  async createUser(createUserDto: CreateUserDto): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> cj78');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        return response;
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        response.code = 409;
        response.msg = 'A user with this email already exists';
        return response;
      }

      const user = await this.prisma.user.create({ data: createUserDto });

      if (user.countryPhoneCode) {
        user.countryPhoneCode =
          reverseCountryPhoneCodeMap[user.countryPhoneCode];
      }

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
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> xw7q');
        response.code = 500;
        response.msg =
          'Could not connect to DB, no prisma client created error getting secret';
        return response;
      }

      const user = await this.prisma.user.findUnique({ where: { id } });

      if (user.countryPhoneCode) {
        user.countryPhoneCode =
          reverseCountryPhoneCodeMap[user.countryPhoneCode];
      }

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
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> decbj4 db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      if (updateUserDto.email) {
        const existingUser = await this.prisma.user.findFirst({
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

      const user = await this.prisma.user.update({
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
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      const user = await this.prisma.user.delete({
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
}
