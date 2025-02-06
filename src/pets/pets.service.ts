import { Injectable } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { CreatePetDto, UpdatePetDto } from './dto';
import { GeneralResponseDto } from '../common';

@Injectable()
export class PetsService {
  private prisma: any = null;

  constructor(private readonly prismaProvider: PrismaProvider) {}

  async getUserPets(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const pets = await this.prisma.pet.findMany({ where: { userId } });
      if (!pets) {
        response.code = 404;
        response.msg = "You don't have any registered pets yet";
        return response;
      }

      response.code = 200;
      response.msg = 'Pets retrieved successfully';
      response.response = pets;
      return response;
    } catch (error) {
      console.error('Error fetching pets:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching pets';
      return response;
    }
  }

  async getPetById(petId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const pet = await this.prisma.pet.findFirst({
        where: { id: petId },
      });

      if (!pet || pet.length === 0) {
        response.code = 404;
        response.msg = 'Pet not found';
        return response;
      }

      response.code = 200;
      response.msg = 'Pet retrieved successfully';
      response.response = pet;
      return response;
    } catch (error) {
      console.error('Error fetching pet:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while fetching the pet';
      return response;
    }
  }

  async createPet(
    userId: string,
    createPetDto: CreatePetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const pet = await this.prisma.pet.create({
        data: { userId, ...createPetDto },
      });

      response.code = 201;
      response.msg = 'Pet created successfully';
      response.response = pet;
      return response;
    } catch (error) {
      console.error('Error creating pet:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while creating the pet';
      return response;
    }
  }

  async updatePet(
    petId: string,
    updatePetDto: UpdatePetDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      const pet = await this.prisma.pet.update({
        where: { id: petId },
        data: updatePetDto,
      });

      response.code = 200;
      response.msg = 'Pet updated successfully';
      response.response = pet;
      return response;
    } catch (error) {
      console.error('Error updating pet:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while updating the pet';
      return response;
    }
  }

  async deletePet(petId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      await this.prisma.pet.delete({ where: { id: petId } });

      response.code = 200;
      response.msg = 'Pet deleted successfully';
      return response;
    } catch (error) {
      console.error('Error deleting pet:', error);
      response.code = 500;
      response.msg = 'An unexpected error occurred while deleting the pet';
      return response;
    }
  }
}
