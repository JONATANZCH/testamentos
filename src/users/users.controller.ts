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
    @Param('id') _dummy: string,
    @Req() req: Request,
  ): Promise<GeneralResponseDto> {
    console.log('--- Controller: GET /wills/users/:id');
    console.log('Full request object:', req);

    const authorizerData = req['requestContext']?.authorizer;
    console.log('Controller - authorizerData:', authorizerData);

    if (!authorizerData) {
      console.log('No authorizer data found in requestContext');
      const response = new GeneralResponseDto({
        code: 401,
        msg: 'No authorizer data found',
        response: null,
      });
      throw new HttpException(response, HttpStatus.UNAUTHORIZED);
    }

    // 2. Extraer claims
    const claims = authorizerData.claims || authorizerData?.jwt?.claims;
    console.log('Controller - claims:', claims);

    const email = claims?.username;
    if (!email) {
      console.log('No username found in token claims');
      const response = new GeneralResponseDto({
        code: 401,
        msg: 'No username found in token claims',
        response: null,
      });
      throw new HttpException(response, HttpStatus.UNAUTHORIZED);
    }

    // 3. Llamar al servicio
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
}
