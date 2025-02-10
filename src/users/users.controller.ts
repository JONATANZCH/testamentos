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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
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
    console.log(
      'Authorizer:',
      JSON.stringify(req['requestContext'].authorizer, null, 2),
    );
    const requestContext = req['requestContext'] || {};
    const authorizer = requestContext.authorizer;
    const claims =
      (authorizer && authorizer.claims) ||
      (authorizer && authorizer.jwt && authorizer.jwt.claims);
    if (!claims || !claims.username) {
      const response = new GeneralResponseDto();
      response.code = 401;
      response.msg = 'Unauthorized: Missing username in token';
      response.response = null;
      return response;
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
