import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PetsService } from './pets.service';
import { CreatePetDto, UpdatePetDto } from './dto';
import { GeneralResponseDto } from '../common';
import { ConfigService } from '../config';

@Controller('wills')
export class PetsController {
  private readonly environment: string;

  constructor(
    private readonly petsService: PetsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, PetsController);
  }

  @Get('user/:userId/pets')
  async getUserPets(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    return this.petsService.getUserPets(userId);
  }

  @Get('/pets/:petId')
  async getPetById(
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<GeneralResponseDto> {
    return this.petsService.getPetById(petId);
  }

  @Post('user/:userId/pets')
  async createPet(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createPetDto: CreatePetDto,
  ): Promise<GeneralResponseDto> {
    return this.petsService.createPet(userId, createPetDto);
  }

  @Put('/pets/:petId')
  async updatePet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() updatePetDto: UpdatePetDto,
  ): Promise<GeneralResponseDto> {
    return this.petsService.updatePet(petId, updatePetDto);
  }

  @Delete('/pets/:petId')
  async deletePet(
    @Param('petId', ParseUUIDPipe) petId: string,
  ): Promise<GeneralResponseDto> {
    return this.petsService.deletePet(petId);
  }
}
