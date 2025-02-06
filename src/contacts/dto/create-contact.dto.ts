import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CountryCode } from '../../common/enums/country-code.enum';
import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';
import { RelationToUser } from '../../common/enums/relation-to-user.enum';
import { mapCountryPhoneCode } from '../../common/utils/mapCountryPhoneCode';

export class CreateContactDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsString()
  @IsOptional()
  readonly middleName?: string;

  @IsString()
  @IsOptional()
  readonly fatherLastName?: string;

  @IsString()
  @IsOptional()
  readonly motherLastName?: string;

  @IsOptional()
  @IsEnum(RelationToUser, {
    message:
      'Invalid relation to user. Must be one of: sibling, child, spouse, friend, parent, none, albacea',
  })
  relationToUser?: RelationToUser;

  @IsOptional()
  @Transform(({ value }) => mapCountryPhoneCode(value))
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
