import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CountryCode } from '../../common';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  suburb?: string;

  @IsNotEmpty()
  @IsEnum(CountryCode, {
    message: 'Invalid country code',
  })
  country: CountryCode;
}
