import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreateContactDto, UpdateContactDto } from './dto';
import { GeneralResponseDto } from '../common';

@Injectable()
export class ContactsService {
  private prisma: any = null;
  private _prismaprovider: PrismaProvider;

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
        return response;
      }

      const offset = (page - 1) * limit;
      const [contacts, total] = await Promise.all([
        this.prisma.contact.findMany({
          where: { userId },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.contact.count({ where: { userId } }),
      ]);

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
      console.error('Error fetching contacts:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching contacts';
      return response;
    }
  }

  async getContactById(
    userId: string,
    contactId: string,
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

      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId },
      });

      if (!contact) {
        response.code = 404;
        response.msg = 'Contact not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Contact retrieved successfully';
      response.response = contact;
      return response;
    } catch (error) {
      console.error('Error fetching contact by id:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching the contact';
      return response;
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
        return response;
      }

      const { legalEntityId, ...contactData } = createContactDto;

      const contact = await this.prisma.contact.create({
        data: {
          userId,
          legalEntityId,
          ...contactData,
        },
      });

      response.code = 201;
      response.msg = 'Contact created successfully';
      response.response = contact;
      return response;
    } catch (error) {
      console.error('Error creating contact:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while creating the contact';
      return response;
    }
  }

  async updateContact(
    userId: string,
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
        where: { id: contactId, userId },
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

  async deleteContact(
    userId: string,
    contactId: string,
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

      await this.prisma.contact.delete({
        where: { id: contactId, userId },
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
