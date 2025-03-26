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
  @UseGuards(AuthorizerGuard)
  async getUserById(@Param('id') _dummy: string, @Req() req: Request) {
    const authorizerData = req['authorizerData'];
    const claims = authorizerData.claims;
    const email = claims.username || claims.email || claims.name;

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
