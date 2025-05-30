import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Put,
  UseInterceptors,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { PaginationDto } from '../common';
import { GeneralResponseDto } from '../common/response.dto';
import { ConfigService } from '../config';
import { CountryPhoneCodeTransformInterceptor } from '../common/interceptors/contacts-transform.interceptor';
import { AuthorizerGuard } from '../common/utils/authorizer.guard';

@Controller('wills/users')
@UseInterceptors(CountryPhoneCodeTransformInterceptor)
export class UsersController {
  private readonly environment: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/users';
    Reflect.defineMetadata('path', this.environment, UsersController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post()
  @UseGuards(AuthorizerGuard)
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @Req() req: Request,
  ): Promise<GeneralResponseDto> {
    console.log('Create user request received');
    const claims = req['authorizerData'].claims;
    const tokenEmail =
      claims.username || claims.email || claims.name || claims.userId;
    if (
      tokenEmail &&
      createUserDto.email &&
      tokenEmail.toLowerCase() !== createUserDto.email.toLowerCase()
    ) {
      throw new HttpException(
        {
          code: 400,
          msg: 'The user does not match the token',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    let oauthId = '';
    let authTool = '';
    if (claims?.sub) {
      oauthId = claims.sub;
      authTool = 'cognito';
    } else if (claims?.userId) {
      oauthId = claims.userId;
      authTool = 'auth0';
    } else {
      throw new HttpException(
        { code: 400, msg: 'No valid oauthId found in token' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const dataToSave = {
      ...createUserDto,
      oauthId,
      authTool,
    };
    return this.usersService.createUser(dataToSave);
  }

  @Get()
  async getAllUsers(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log('Get all users request received');
    const { page, limit } = paginationDto;
    return this.usersService.getAllUsers(page, limit);
  }

  @Get('/:id')
  @UseGuards(AuthorizerGuard)
  async getUserById(@Param('id') _dummy: string, @Req() req: Request) {
    const authorizerData = req['authorizerData'];
    const claims = authorizerData.claims;
    const email =
      claims.username || claims.email || claims.name || claims.userId;

    return this.usersService.findUser(email);
  }

  @Put('/:id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update user request received');
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete('/:id')
  async softDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GeneralResponseDto> {
    console.log('Soft delete user request received');
    return this.usersService.deleteUserPermanently(id);
  }

  @Get('/:id/completness')
  async getUserProgress(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[getUserProgress] Get user progress request received');
    return await this.usersService.getUserProgress(userId);
  }
}
