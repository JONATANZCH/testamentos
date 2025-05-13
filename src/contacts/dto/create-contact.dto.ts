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
import { capitalizeFirstLetter } from '../../common/utils/transform-capitalize.util';
import { MaritalRegime } from '../../common/enums/marital-regime.enum';

export class CreateContactDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => capitalizeFirstLetter(value))
  readonly name: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => capitalizeFirstLetter(value))
  readonly middleName?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => capitalizeFirstLetter(value))
  readonly fatherLastName?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => capitalizeFirstLetter(value))
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

  @ValidateIf((o) => o.relationToUser === RelationToUser.SPOUSE) // Solo valida si es cónyuge
  @IsNotEmpty({
    message:
      'The maritalRegime field is mandatory when the relationship is spouse.',
  })
  @IsEnum(MaritalRegime, {
    message: `The marital regime must be one of the following: ${Object.values(MaritalRegime).join(', ')}`,
  })
  @IsOptional() // Es opcional en general, pero ValidateIf lo hace requerido para SPOUSE
  readonly maritalRegime?: MaritalRegime;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const mapped = countryPhoneCodeMap[value];
    if (!mapped) {
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

  @IsBoolean({
    message: 'isLegallyIncapacitated must be a boolean value (true or false)',
  })
  @IsOptional()
  readonly isLegallyIncapacitated?: boolean;
}
