import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Put,
  Delete,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto';
import { ConfigService } from 'src/config';
import { GeneralResponseDto } from 'src/common';

@Controller()
export class AddressesController {
  private readonly environment: string;

  constructor(
    private readonly addressesService: AddressesService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv();
    Reflect.defineMetadata('path', this.environment, AddressesController);
  }

  @Get('user/:userId/address')
  async getUserAddresses(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user addresses request received');
    return this.addressesService.getUserAddresses(userId);
  }

  @Get('user/:userId/address/:addressId')
  async getAddressById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user address by ID request received');
    return this.addressesService.getAddressById(userId, addressId);
  }

  @Post('user/:userId/address')
  async createUserAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create user address request received');
    return this.addressesService.createUserAddress(userId, createAddressDto);
  }

  @Put('user/:userId/address/:addressId')
  async updateAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update user address request received');
    return this.addressesService.updateAddress(
      userId,
      addressId,
      updateAddressDto,
    );
  }

  @Delete('user/:userId/address/:addressId')
  async deleteAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Delete user address request received');
    return this.addressesService.deleteAddress(userId, addressId);
  }
}
