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
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { PaginationDto } from '../common';
import { GeneralResponseDto } from '../common/response.dto';
import { ConfigService } from '../config';
import { CountryPhoneCodeTransformInterceptor } from '../common/interceptors/contacts-transform.interceptor';

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
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create user request received');
    return this.usersService.createUser(createUserDto);
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
  async getUserById(
    @Param('id') dummy: string,
    @Req() req: Request,
  ): Promise<GeneralResponseDto> {
    console.log('Get user by id request (login endpoint)');
    console.log('Request in controller:', req);
    const authorizerData = req['requestContext']?.authorizer;
    if (!authorizerData) {
      console.log('Authorizer data not found in requestContext');
      console.log('RequestContext:', req['requestContext']);
      const r = new GeneralResponseDto({
        code: 401,
        msg: 'Unauthorized: Missing authorizer data in requestContext',
        response: null,
      });
      console.log('Response:', r);
      throw new HttpException(r, HttpStatus.UNAUTHORIZED);
    }

    const claims =
      authorizerData.claims ||
      (authorizerData.jwt && authorizerData.jwt.claims);
    if (!claims || !claims.username) {
      throw new HttpException(
        new GeneralResponseDto({
          code: 401,
          msg: 'Unauthorized: Missing username in token',
          response: null,
        }),
        HttpStatus.UNAUTHORIZED,
      );
    }

    const email = claims.username;
    return await this.usersService.findUser(email);
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
}
