import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers'; // Ajusta la ruta según tu estructura
import { CreateLegacyDto, UpdateLegacyDto } from './dto';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class LegaciesService {
  private prisma: any = null;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async createLegacy(
    testamentId: string,
    createLegacyDto: CreateLegacyDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const { contactId, name, description, value, currency } = createLegacyDto;

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
        select: {
          id: true,
          status: true,
        },
      });
      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (testament.status !== 'DRAFT') {
        response.code = 400;
        response.msg =
          'Legacies can only be created for testaments in "DRAFT" status.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const contact = await this.prisma.contact.findUnique({
        where: { id: contactId },
      });
      if (!contact) {
        response.code = 404;
        response.msg = 'Contact not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const newLegacy = await this.prisma.legacy.create({
        data: {
          testamentId,
          contactId,
          name,
          description,
          value,
          currency,
        },
        select: {
          id: true,
          testamentId: true,
          contactId: true,
          name: true,
          createdAt: true,
        },
      });

      response.code = 201;
      response.msg = 'Legacy created successfully';
      response.response = newLegacy;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getAllLegaciesByTestament(
    testamentId: string,
    page: number,
    limit: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Convertir page y limit a enteros
      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;

      // Verificar que el testamento exista
      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: testamentId },
      });
      if (!testament) {
        response.code = 404;
        response.msg = 'Testament not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Buscar las Legacy asociadas
      const [legacies, total] = await Promise.all([
        this.prisma.legacy.findMany({
          where: { testamentId },
          skip: offset,
          take: limitNumber,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            testamentId: true,
            contactId: true,
            name: true,
            createdAt: true,
          },
        }),
        this.prisma.legacy.count({ where: { testamentId } }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = 'No legacies found for this testament.';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Legacies retrieved successfully';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        legacies,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getLegacyById(legacyId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const legacy = await this.prisma.legacy.findUnique({
        where: { id: legacyId },
        select: {
          id: true,
          testamentId: true,
          contactId: true,
          name: true,
          description: true,
          value: true,
          currency: true,
          createdAt: true,
        },
      });

      if (!legacy) {
        response.code = 404;
        response.msg = 'Legacy not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Legacy retrieved successfully';
      response.response = legacy;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updateLegacy(
    legacyId: string,
    updateLegacyDto: UpdateLegacyDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Verificar existencia
      const existingLegacy = await this.prisma.legacy.findUnique({
        where: { id: legacyId },
        select: {
          id: true,
          testamentId: true,
        },
      });
      if (!existingLegacy) {
        response.code = 404;
        response.msg = 'Legacy not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const testament = await this.prisma.testamentHeader.findUnique({
        where: { id: existingLegacy.testamentId },
        select: { status: true },
      });

      if (testament.status !== 'DRAFT') {
        response.code = 400;
        response.msg =
          'Legacies can only be updated if the associated testament is in "DRAFT" status.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // Si se envía contactId, validar que el contacto exista
      if (updateLegacyDto.contactId) {
        const contact = await this.prisma.contact.findUnique({
          where: { id: updateLegacyDto.contactId },
        });
        if (!contact) {
          response.code = 404;
          response.msg = 'Contact not found';
          throw new HttpException(response, HttpStatus.NOT_FOUND);
        }
      }

      const updatedLegacy = await this.prisma.legacy.update({
        where: { id: legacyId },
        data: updateLegacyDto,
        select: {
          id: true,
          testamentId: true,
          contactId: true,
          name: true,
          description: true,
          value: true,
          currency: true,
          updatedAt: true,
        },
      });

      response.code = 200;
      response.msg = 'Legacy updated successfully';
      response.response = updatedLegacy;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async deleteLegacy(legacyId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Verificar existencia
      const existingLegacy = await this.prisma.legacy.findUnique({
        where: { id: legacyId },
      });
      if (!existingLegacy) {
        response.code = 404;
        response.msg = 'Legacy not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      await this.prisma.legacy.delete({ where: { id: legacyId } });

      response.code = 200;
      response.msg = 'Legacy deleted successfully';
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
