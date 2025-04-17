import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsNotEmpty,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CountryCode } from '../../common/enums/country-code.enum';
import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';
import { RelationToUser } from '../../common/enums/relation-to-user.enum';
import { countryPhoneCodeMap } from '../../common/utils/mapCountryPhoneCode';
import { BadRequestException } from '@nestjs/common';
import { Gender } from '../../common/enums/gender.enum';

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

  @IsNotEmpty()
  @IsEnum(RelationToUser, {
    message:
      'Invalid relation to user. Must be one of: sibling, child, spouse, friend, parent, none, albacea',
  })
  relationToUser: RelationToUser;

  @ValidateIf((o) => o.relationToUser === RelationToUser.CHILD)
  @IsNotEmpty({
    message:
      'El campo otherParentId es obligatorio cuando relationToUser es child',
  })
  @IsUUID('4', { message: 'El otherParentId debe ser un UUID válido' })
  readonly otherParentId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const mapped = countryPhoneCodeMap[value];
    if (!mapped) {
      // Si no existe ese código, lanza excepción 400
      throw new BadRequestException(`Invalid country phone code: ${value}`);
    }
    return mapped;
  })
  @IsEnum(CountryPhoneCode, {
    message: 'countryPhoneCode must be a valid country phone code',
  })
  countryPhoneCode?: CountryPhoneCode;

  @IsOptional()
  @IsEnum(CountryCode, {
    message: 'country must be a valid country code',
  })
  country?: CountryCode;

  @IsString()
  @IsOptional()
  @IsEnum(Gender, {
    message: 'Gender not valid',
  })
  readonly gender?: Gender;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsDateString(
    {},
    { message: 'birthDate must be a valid ISO-8601 date string' },
  )
  @IsOptional()
  readonly birthDate?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @IsString()
  @IsOptional()
  readonly governmentId?: string;

  @IsOptional()
  @IsBoolean()
  trustedContact?: boolean;
}
