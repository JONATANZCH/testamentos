import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
import { ConfigService } from '../config';
import { CountryPhoneCodeTransformInterceptor } from '../common/interceptors/contacts-transform.interceptor';

@Controller('wills')
@UseInterceptors(CountryPhoneCodeTransformInterceptor)
export class ContactsController {
  private readonly environment: string;

  constructor(
    private readonly contactsService: ContactsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, ContactsController);
    console.log('Version - 20250130 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Get('/users/:userId/contacts')
  async getUserContacts(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log('Get user contacts request received');
    const { page, limit } = paginationDto;
    return this.contactsService.getUserContacts(userId, page, limit);
  }

  @Get('/contacts/:contactId')
  async getContactById(
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Get contact by id request received');
    return this.contactsService.getContactById(contactId);
  }

  @Post('/users/:userId/contacts')
  async createContact(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createContactDto: CreateContactDto,
  ): Promise<GeneralResponseDto> {
    console.log('Create contact request received');
    return this.contactsService.createContact(userId, createContactDto);
  }

  @Put('/contacts/:contactId')
  async updateContact(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() updateContactDto: UpdateContactDto,
  ): Promise<GeneralResponseDto> {
    console.log('Update contact request received');
    return this.contactsService.updateContact(contactId, updateContactDto);
  }

  @Delete('/contacts/:contactId')
  async deleteContact(
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<GeneralResponseDto> {
    console.log('Delete contact request received');
    return this.contactsService.deleteContact(contactId);
  }
}
