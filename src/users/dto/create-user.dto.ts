import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '../../common/enums/gender.enum';
import { CountryCode } from '../../common/enums/country-code.enum';
import { CountryPhoneCode } from '../../common/enums/country-phone-code.enum';
import { MaritalStatus } from '../../common/enums/marital-status.enum';
import { mapCountryPhoneCode } from '../../common/utils/mapCountryPhoneCode';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @IsNotEmpty()
  @IsString()
  readonly firstName: string;

  @IsString()
  @IsOptional()
  readonly lastName?: string;

  @IsString()
  @IsOptional()
  readonly middleName?: string;

  @IsString()
  @IsOptional()
  readonly governmentId?: string;

  @IsDateString()
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
  @Transform(({ value }) => mapCountryPhoneCode(value))
  @IsEnum(CountryPhoneCode, {
    message: 'Invalid country phone code',
  })
  readonly countryCode?: CountryPhoneCode;

  @IsString()
  @IsOptional()
  @IsEnum(MaritalStatus, {
    message: 'Invalid marital status',
  })
  readonly maritalstatus?: string;
}
