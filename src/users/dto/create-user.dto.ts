import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '../../common/enums/gender.enum';
import { CountryCode } from '../../common/enums/country-code.enum';
import { MaritalStatus } from '../../common/enums/marital-status.enum';
import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';
import { countryPhoneCodeMap } from '../../common/utils/mapCountryPhoneCode';
import { BadRequestException } from '@nestjs/common';
import { capitalizeFirstLetter } from '../../common/utils/transform-capitalize.util';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

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

  @IsString()
  @IsOptional()
  readonly governmentId?: string;

  @IsDateString(
    {},
    { message: 'birthDate must be a valid ISO-8601 date string' },
  )
  @IsOptional()
  readonly birthDate?: string;

  @IsString()
  @IsOptional()
  @IsEnum(CountryCode, {
    message: 'Invalid country code',
  })
  readonly nationality?: string;

  @IsString()
  @IsOptional()
  @IsEnum(Gender, {
    message: 'Gender not valid',
  })
  readonly gender: Gender;

  @IsString()
  @IsOptional()
  readonly phoneNumber?: string;

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
    message: 'Invalid country phone code',
  })
  readonly countryPhoneCode?: CountryPhoneCode;

  @IsString()
  @IsOptional()
  @IsEnum(MaritalStatus, {
    message: 'Invalid marital status',
  })
  readonly maritalstatus?: string;

  @IsOptional()
  @IsBoolean()
  hasChildren?: boolean;

  @IsOptional()
  @IsBoolean()
  hasPets?: boolean;
}
