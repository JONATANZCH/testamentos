import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreatePetDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsString()
  readonly species: string;

  @IsString()
  @IsOptional()
  readonly breed?: string;

  @IsDateString()
  @IsOptional()
  readonly dateOfBirth?: string; // Fecha de nacimiento opcional en formato ISO

  @IsString()
  @IsOptional()
  readonly notes?: string; // Notas opcionales
}
