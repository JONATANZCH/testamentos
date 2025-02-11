import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreatePetDto, UpdatePetDto } from './dto';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';

@Injectable()
export class PetsService {
  private prisma: any = null;
  private readonly environment: string;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserPets(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const userExists = await this.prisma.user.findFirst({
        where: { id: userId },
      });
      if (!userExists) {
        response.code = 404;
        response.msg = 'User not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const pets = await this.prisma.pet.findMany({ where: { userId } });
      if (!pets || pets.length === 0) {
        response.code = 404;
        response.msg = "User doesn't have any pets";
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Pets retrieved successfully';
      response.response = pets;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async getPetById(petId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const pet = await this.prisma.pet.findFirst({
        where: { id: petId },
      });

      if (!pet || pet.length === 0) {
        response.code = 404;
        response.msg = 'Pet not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Pet retrieved successfully';
      response.response = pet;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async createPet(
    userId: string,
    createPetDto: CreatePetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const userExists = await this.prisma.user.findFirst({
        where: { id: userId },
      });
      if (!userExists) {
        response.code = 404;
        response.msg = 'User not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      if (createPetDto.dateOfBirth) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(createPetDto.dateOfBirth)) {
          response.code = 400;
          response.msg =
            'Invalid birthDate format. Expected ISO-8601 DateTime.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
      }

      const pet = await this.prisma.pet.create({
        data: { userId, ...createPetDto },
      });

      response.code = 201;
      response.msg = 'Pet created successfully';
      response.response = pet;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async updatePet(
    petId: string,
    updatePetDto: UpdatePetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const pet = await this.prisma.pet.update({
        where: { id: petId },
        data: updatePetDto,
      });

      if (!pet || pet.length === 0) {
        response.code = 404;
        response.msg = 'Pet not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (updatePetDto.dateOfBirth) {
        const isoRegex =
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|([+-]\d{2}:\d{2}))$/;
        if (!isoRegex.test(updatePetDto.dateOfBirth)) {
          response.code = 400;
          response.msg =
            'Invalid birthDate format. Expected ISO-8601 DateTime.';
          throw new HttpException(response, HttpStatus.BAD_REQUEST);
        }
      }

      response.code = 200;
      response.msg = 'Pet updated successfully';
      response.response = pet;
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async deletePet(petId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> nxui8');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      await this.prisma.pet.delete({ where: { id: petId } });

      response.code = 200;
      response.msg = 'Pet deleted successfully';
      return response;
    } catch (error) {
      processException(error);
    }
  }
}
