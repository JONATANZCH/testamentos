import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { Prisma } from '@prisma/client';
import { CreateContactDto, UpdateContactDto } from './dto';
import { GeneralResponseDto } from '../common';
import { reverseCountryPhoneCodeMap } from '../common/utils/reverseCountryPhoneCodeMap';
import { processException } from '../common/utils/exception.helper';
import { RelationToUser } from '../common/enums/relation-to-user.enum';

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

      // if (createContactDto.relationToUser === RelationToUser.CHILD) {
      //   if (!createContactDto.otherParentId) {
      //     response.code = 400;
      //     response.msg =
      //       'The otherParentId field is required for child contacts.';
      //     throw new HttpException(response, HttpStatus.BAD_REQUEST);
      //   }
      //   // Verificar que otherParentId corresponda a un contacto existente
      //   const parentContact = await this.prisma.contact.findUnique({
      //     where: { id: createContactDto.otherParentId },
      //   });
      //   if (!parentContact) {
      //     response.code = 400;
      //     response.msg =
      //       'The otherParentId provided does not correspond to an existing contact.';
      //     throw new HttpException(response, HttpStatus.BAD_REQUEST);
      //   }
      // }

      const {
        legalEntityId,
        maritalRegime: maritalRegimeFromDto,
        birthDate: birthDateString,
        ...contactData
      } = createContactDto;

      const dataToCreate: Prisma.ContactCreateInput = {
        user: { connect: { id: userId } },
        ...contactData,
        relationToUser: createContactDto.relationToUser,
      };

      if (createContactDto.isLegallyIncapacitated !== undefined) {
        dataToCreate.isLegallyIncapacitated =
          createContactDto.isLegallyIncapacitated;
      }

      if (birthDateString) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(birthDateString)) {
          throw new HttpException(
            'Invalid birthDate format. Expected ISO-8601 DateTime.',
            HttpStatus.BAD_REQUEST,
          );
        }
        dataToCreate.birthDate = new Date(birthDateString);
      }

      if (legalEntityId) {
        const legalEntityExists = await this.prisma.legalEntity.findUnique({
          where: { id: legalEntityId },
        });

        if (!legalEntityExists) {
          response.code = 400;
          response.msg = 'The provided legalEntityId does not exist';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
        dataToCreate.legalEntity = {
          connect: {
            id: legalEntityId,
          },
        };
      }

      if (createContactDto.relationToUser === RelationToUser.SPOUSE) {
        dataToCreate.maritalRegime = maritalRegimeFromDto;
      } else {
        dataToCreate.maritalRegime = null;
        if (maritalRegimeFromDto) {
          console.warn(
            `WARN: maritalRegime field was provided for a contact with relation '${createContactDto.relationToUser}' and will be ignored/set to null.`,
          );
        }
      }

      const contact = await this.prisma.contact.create({
        data: dataToCreate,
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

      const existingContact = await this.prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!existingContact) {
        response.code = 404;
        response.msg = 'Contact not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const dataToUpdate: Prisma.ContactUpdateInput = {};
      const {
        legalEntityId,
        maritalRegime: maritalRegimeFromDto,
        relationToUser: relationToUserFromDto,
        otherParentId: otherParentIdFromDto,
        birthDate: birthDateString,
        isLegallyIncapacitated,
        ...otherUpdateData
      } = updateContactDto;

      for (const key in otherUpdateData) {
        if (
          Object.prototype.hasOwnProperty.call(otherUpdateData, key) &&
          otherUpdateData[key] !== undefined
        ) {
          dataToUpdate[key] = otherUpdateData[key];
        }
      }

      if (isLegallyIncapacitated !== undefined) {
        dataToUpdate.isLegallyIncapacitated = isLegallyIncapacitated;
      }

      if (birthDateString === null) {
        dataToUpdate.birthDate = null;
      } else if (birthDateString) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(birthDateString)) {
          throw new HttpException(
            'Invalid birthDate format. Expected ISO-8601 DateTime.',
            HttpStatus.BAD_REQUEST,
          );
        }
        dataToUpdate.birthDate = new Date(birthDateString);
      }

      if (legalEntityId === null) {
        dataToUpdate.legalEntity = { disconnect: true };
      } else if (legalEntityId) {
        const legalEntityExists = await this.prisma.legalEntity.findUnique({
          where: { id: legalEntityId },
        });
        if (!legalEntityExists) {
          throw new HttpException(
            'The provided legalEntityId does not exist',
            HttpStatus.BAD_REQUEST,
          );
        }
        dataToUpdate.legalEntity = { connect: { id: legalEntityId } };
      }

      const finalRelationToUser =
        relationToUserFromDto ?? existingContact.relationToUser;
      if (relationToUserFromDto) {
        dataToUpdate.relationToUser = relationToUserFromDto;
      }

      if (finalRelationToUser === RelationToUser.SPOUSE) {
        if (maritalRegimeFromDto !== undefined) {
          dataToUpdate.maritalRegime = maritalRegimeFromDto;
        } else if (
          !existingContact.maritalRegime &&
          relationToUserFromDto === RelationToUser.SPOUSE
        ) {
          throw new HttpException(
            'Marital regime is required when relation to user is spouse.',
            HttpStatus.BAD_REQUEST,
          );
        }
      } else {
        if (
          existingContact.maritalRegime !== null ||
          maritalRegimeFromDto !== undefined
        ) {
          dataToUpdate.maritalRegime = null;
        }
      }

      if (finalRelationToUser === RelationToUser.CHILD) {
        const finalOtherParentId =
          otherParentIdFromDto ?? existingContact.otherParentId;
        if (
          !finalOtherParentId &&
          (relationToUserFromDto === RelationToUser.CHILD ||
            !existingContact.otherParentId)
        ) {
          throw new HttpException(
            'The otherParentId field is required for child contacts.',
            HttpStatus.BAD_REQUEST,
          );
        }
        if (finalOtherParentId) {
          const parentContactExists = await this.prisma.contact.findUnique({
            where: { id: finalOtherParentId },
          });
          if (!parentContactExists) {
            throw new HttpException(
              'The otherParentId provided does not correspond to an existing contact.',
              HttpStatus.BAD_REQUEST,
            );
          }
        }
        if (otherParentIdFromDto !== undefined) {
          dataToUpdate.otherParentId = otherParentIdFromDto;
        }
      } else {
        if (
          existingContact.otherParentId !== null ||
          otherParentIdFromDto !== undefined
        ) {
          dataToUpdate.otherParentId = null;
        }
      }

      if (Object.keys(dataToUpdate).length === 0) {
        const noChangeResponse = new GeneralResponseDto();
        noChangeResponse.code = 200;
        noChangeResponse.msg = 'No changes detected to update.';
        noChangeResponse.response = existingContact;
        return noChangeResponse;
      }

      const updatedContact = await this.prisma.contact.update({
        where: { id: contactId },
        data: dataToUpdate,
      });

      if (updatedContact.countryPhoneCode) {
        updatedContact.countryPhoneCode =
          reverseCountryPhoneCodeMap[updatedContact.countryPhoneCode] ??
          updatedContact.countryPhoneCode;
      }

      response.code = 200;
      response.msg = 'Contact updated successfully';
      response.response = updatedContact;
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
      processException(error);
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
