import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CountryCode } from '../../common';

export class CreateAddressDto {
  @IsNotEmpty()
  @IsString()
  street: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  zipCode: string;

  @IsNotEmpty()
  @IsEnum(CountryCode, {
    message: 'Invalid country code',
  })
  country: CountryCode;
}
