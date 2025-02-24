import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateContactDto, UpdateContactDto } from './dto';
import { GeneralResponseDto } from '../common';
import { reverseCountryPhoneCodeMap } from '../common/utils/reverseCountryPhoneCodeMap';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class ContactsService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;
  private readonly environment: string;

  constructor(private prismaprovider: PrismaProvider) {
    this._prismaprovider = prismaprovider;
  }

  async getUserContacts(
    userId: string,
    page: number,
    limit: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
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
      const [contacts, total] = await Promise.all([
        this.prisma.contact.findMany({
          where: { userId },
          skip: offset,
          take: limitNumber,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.contact.count({ where: { userId } }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = "You don't have any registered contacts yet";
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (contacts.countryPhoneCode) {
        contacts.countryPhoneCode =
          reverseCountryPhoneCodeMap[contacts.countryPhoneCode];
      }

      response.code = 200;
      response.msg = 'Contacts retrieved successfully';
      response.response = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        contacts,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getContactById(contactId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId },
      });

      if (!contact) {
        response.code = 404;
        response.msg = 'Contact not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Contact retrieved successfully';
      response.response = contact;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createContact(
    userId: string,
    createContactDto: CreateContactDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        response.code = 404;
        response.msg = `User not found`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const { legalEntityId, ...contactData } = createContactDto;
      if (legalEntityId) {
        const legalEntityExists = await this.prisma.legalEntity.findUnique({
          where: { id: legalEntityId },
        });

        if (!legalEntityExists) {
          response.code = 400;
          response.msg = 'The provided legalEntityId does not exist';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
      }

      if (createContactDto.birthDate) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(createContactDto.birthDate)) {
          response.code = 400;
          response.msg =
            'Invalid birthDate format. Expected ISO-8601 DateTime.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
      }

      const contact = await this.prisma.contact.create({
        data: {
          userId,
          legalEntityId,
          ...contactData,
        },
      });

      if (contact.countryPhoneCode) {
        contact.countryPhoneCode =
          reverseCountryPhoneCodeMap[contact.countryPhoneCode];
      }

      response.code = 201;
      response.msg = 'Contact created successfully';
      response.response = contact;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateContact(
    contactId: string,
    updateContactDto: UpdateContactDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      const contact = await this.prisma.contact.update({
        where: { id: contactId },
        data: updateContactDto,
      });

      response.code = 200;
      response.msg = 'Contact updated successfully';
      response.response = contact;
      return response;
    } catch (error) {
      console.error('Error updating contact:', error);
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = 'Contact not found';
        return response;
      }
      response.code = 500;
      response.msg = 'An unexpected error occurred while updating the contact';
      return response;
    }
  }

  async deleteContact(contactId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this._prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log('Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        return response;
      }

      await this.prisma.contact.delete({
        where: { id: contactId },
      });

      response.code = 200;
      response.msg = 'Contact deleted successfully';
      return response;
    } catch (error) {
      console.error('Error deleting contact:', error);
      if (error.code === 'P2025') {
        response.code = 404;
        response.msg = 'Contact not found';
        return response;
      }
      response.code = 500;
      response.msg = 'An unexpected error occurred while deleting the contact';
      return response;
    }
  }
}
