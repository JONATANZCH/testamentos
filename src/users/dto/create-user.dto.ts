import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  readonly firstName: string;

  @IsString()
  @IsOptional()
  readonly lastName?: string = 'N/A';

  @IsString()
  @IsOptional()
  readonly middleName?: string = 'N/A';

  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsBoolean()
  readonly acceptTerms: boolean;

  @IsBoolean()
  readonly acceptOffers: boolean;
}
