import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { CurrencyCode } from '../../common/enums/currency-code.enum';

export class CreateLegacyDto {
  @IsNotEmpty()
  @IsUUID()
  contactId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsNotEmpty()
  @IsEnum(CurrencyCode, {
    message: 'currency must be a valid ISO 4217 currency code',
  })
  currency: CurrencyCode;
}
