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

@Controller('wills')
export class AddressesController {
  private readonly environment: string;

  constructor(
    private readonly addressesService: AddressesService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, AddressesController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Get('user/:userId/address')
  async getUserAddresses(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user addresses request received');
    return this.addressesService.getUserAddresses(userId);
  }

  @Get('/address/:addressId')
  async getAddressById(
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get user address by ID request received');
    return this.addressesService.getAddressById(addressId);
  }

  @Post('user/:userId/address')
  async createUserAddress(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create user address request received');
    return this.addressesService.createUserAddress(userId, createAddressDto);
  }

  @Put('/address/:addressId')
  async updateAddress(
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update user address request received');
    return this.addressesService.updateAddress(addressId, updateAddressDto);
  }

  @Delete('/address/:addressId')
  async deleteAddress(
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Delete user address request received');
    return this.addressesService.deleteAddress(addressId);
  }
}
