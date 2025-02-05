import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { CountryCode } from '../../common/enums/country-code.enum';
import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';

export class CreateContactDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  relationToUser?: string;

  @IsOptional()
  @IsEnum(CountryPhoneCode, {
    message: 'countryPhoneCode must be a valid country phone code',
  })
  countryPhoneCode?: CountryPhoneCode;

  @IsOptional()
  @IsEnum(CountryCode, {
    message: 'country must be a valid country code',
  })
  country?: CountryCode;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @IsOptional()
  @IsBoolean()
  trustedContact?: boolean;
}
