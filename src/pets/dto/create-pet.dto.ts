import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { PetSpecies } from '../../common/enums/pets-species.enum';

export class CreatePetDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsEnum(PetSpecies, {
    message: `Invalid species. The allowed values are: ${Object.values(PetSpecies).join(', ')}`,
  })
  readonly species: string;

  @IsDateString()
  @IsOptional()
  readonly dateOfBirth?: string; // Fecha de nacimiento opcional en formato ISO

  @IsString()
  @IsOptional()
  readonly notes?: string; // Notas opcionales
}
