import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateUserDto, UpdateUserDto } from './dto';
import { GeneralResponseDto } from '../common';
import { reverseCountryPhoneCodeMap } from '../common/utils/reverseCountryPhoneCodeMap';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class UsersService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;
  private readonly environment: string;

  constructor(private prismaprovider: PrismaProvider) {
    this._prismaprovider = prismaprovider;
  }

  async getAllUsers(page: number, limit: number): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Convert page and limit to integers
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
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

      if (total === 0) {
        response.code = 404;
        response.msg = 'No users found';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

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
      processException(error);
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
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        response.code = 409;
        response.msg = 'A user with this email already exists';
        throw new HttpException(response, HttpStatus.CONFLICT);
      }

      if (createUserDto.birthDate) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(createUserDto.birthDate)) {
          response.code = 400;
          response.msg =
            'Invalid birthDate format. Expected ISO-8601 DateTime.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
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
      processException(error);
    }
  }

  async findUser(email: string): Promise<GeneralResponseDto> {
    console.log('--- Service: findUserByEmail');
    console.log('Email =>', email);

    const response = new GeneralResponseDto();
    try {
      const prisma = await this.prismaprovider.getPrismaClient();
      if (!prisma) {
        console.log('Pastpost Error-> xw7q - No prisma instance');
        response.code = 500;
        response.msg = 'Could not connect to DB';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        response.code = 404;
        response.msg = `User with email ${email} not found`;
        console.log(response.msg);
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (user.countryPhoneCode) {
        user.countryPhoneCode =
          reverseCountryPhoneCodeMap[user.countryPhoneCode];
      }

      response.code = 200;
      response.msg = 'User retrieved successfully';
      response.response = user;
      console.log('Returning user =>', user);
      return response;
    } catch (error) {
      processException(error);
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
        console.log('Pastpost Error-> decbj4');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const existingUser = await this.prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        response.code = 404;
        response.msg = `User with id ${id} not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Validate that email is not being updated
      if (updateUserDto.email) {
        response.code = 409;
        response.msg = 'Email cannot be updated directly';
        throw new HttpException(response, HttpStatus.CONFLICT);
      }

      if (updateUserDto.birthDate) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(updateUserDto.birthDate)) {
          response.code = 400;
          response.msg =
            'Invalid birthDate format. Expected ISO-8601 DateTime.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
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
      processException(error);
    }
  }

  async deleteUserPermanently(id: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Pastpost Error-> xbhs9');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const user = await this.prisma.user.delete({
        where: { id },
      });
      console.log('User deleted:', user);

      response.code = 204;
      response.msg = 'User permanently deleted successfully';
      response.response = null;
      return response;
    } catch (error) {
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = `User with id ${id} not found`;
        return response;
      }

      processException(error);
    }
  }

  async getUserProgress(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // 1) Fetch the user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          addresses: true,
          assets: true,
          testamentHeaders: {
            include: {
              TestamentAssignment: true,
              Executor: true,
            },
          },
        },
      });

      if (!user) {
        response.code = 404;
        response.msg = `User with id ${userId} not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      /**
       * STEP 1: PROFILE COMPLETION
       * According to the rules, we have 11 fields,
       * Each field is worth 100 / 11 ≈ 9.09%.
       * If all are present => 100%, else partial sum.
       */
      let profileFieldsCompleted = 0;
      const totalProfileFields = 10;

      // We'll just do a helper function to check presence
      const isFilled = (val: any): boolean =>
        val !== null && val !== undefined && val !== '';

      if (isFilled(user.name)) profileFieldsCompleted++;
      if (isFilled(user.fatherLastName)) profileFieldsCompleted++;
      if (isFilled(user.motherLastName)) profileFieldsCompleted++;
      if (isFilled(user.gender)) profileFieldsCompleted++;
      if (isFilled(user.birthDate)) profileFieldsCompleted++;
      if (isFilled(user.governmentId)) profileFieldsCompleted++;
      if (isFilled(user.phoneNumber)) profileFieldsCompleted++;
      if (isFilled(user.maritalstatus)) profileFieldsCompleted++;
      if (user.addresses && user.addresses.length > 0) profileFieldsCompleted++;
      // hasChildren can be true or false, so we only check if it's not null
      if (user.hasChildren !== null && user.hasChildren !== undefined) {
        profileFieldsCompleted++;
      }
      const profileCompletion =
        (profileFieldsCompleted / totalProfileFields) * 100;

      /**
       * ------------------------------------------------------
       * STEP 2: ASSETS
       * ------------------------------------------------------
       * If user has at least 1 asset => +50%
       * If user has at least 1 testamentHeader => +50% where status is ACTIVE
       */
      let assetsCompletion = 0;
      const userAssetsCount = user.assets?.length || 0;
      const userActiveTestamentsCount =
        user.testamentHeaders?.filter((t) => t.status === 'DRAFT').length || 0;

      if (userAssetsCount > 0) {
        assetsCompletion += 50;
      }
      if (userActiveTestamentsCount > 0) {
        assetsCompletion += 50;
      }

      // STEP 3: ASSIGNMENTS If user has 1 or more assignments => 100% We'll gather all assignments from all testamentHeaders.
      let assignmentsCompletion = 0;
      const allAssignmentsCount = user.testamentHeaders.flatMap(
        (t) => t.TestamentAssignment,
      ).length; // collect all assignments
      if (allAssignmentsCount > 0) {
        assignmentsCompletion = 100;
      }

      // Build the result object
      const progressData = {
        profile: `${profileCompletion.toFixed(1)}%`,
        assets: `${assetsCompletion}%`,
        assignments: `${assignmentsCompletion}%`,
      };

      // Return as part of a GeneralResponseDto
      response.code = 200;
      response.msg = 'User progress retrieved successfully';
      response.response = progressData;
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
