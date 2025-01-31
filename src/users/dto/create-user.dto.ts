import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  readonly firstName: string;

  @IsString()
  @IsOptional()
  readonly lastName?: string;

  @IsString()
  @IsOptional()
  readonly middleName?: string;

  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsString()
  @IsOptional()
  readonly governmentId?: string; // Optional national ID

  @IsDateString()
  @IsOptional()
  readonly birthDate?: string; // Optional date of birth in ISO format

  @IsString()
  @IsOptional()
  readonly nationality?: string; // Optional nationality

  @IsString()
  @IsOptional()
  readonly phoneNumber?: string; // Optional phone number
}
