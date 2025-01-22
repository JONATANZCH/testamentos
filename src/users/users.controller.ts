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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateAddressDto, CreateUserDto, UpdateUserDto } from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
import { ConfigService } from '../config';

@Controller()
export class UsersController {
  private readonly environment: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv();
    Reflect.defineMetadata('path', this.environment, UsersController);
  }

  @Post('user')
  async create(
    @Body() createUserDto: CreateUserDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create user request received');
    return this.usersService.create(createUserDto);
  }

  @Get('users')
  async getAllUsers(
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log('Get all users request received');
    const { page, limit } = paginationDto;
    return this.usersService.getAllUsers(page, limit);
  }

  @Get('user/:id')
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user by id request');
    return await this.usersService.findById(id);
  }

  @Put('user/:id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update user request received');
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete('user/:id')
  async softDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GeneralResponseDto> {
    console.log('Soft delete user request received');
    return this.usersService.deleteUserPermanently(id);
  }

  @Get('user/:userId/address')
  async getUserAddresses(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user addresses request received');
    return this.usersService.getUserAddresses(userId);
  }

  @Get('user/:userId/address/:addressId')
  async getAddressById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user address by ID request received');
    return this.usersService.getAddressById(userId, addressId);
  }

  @Post('user/:userId/address')
  async createUserAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create user address request received');
    return this.usersService.createUserAddress(userId, createAddressDto);
  }
}
