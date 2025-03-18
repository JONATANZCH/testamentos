import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { CurrencyCode } from '../../common/enums/currency-code.enum';

export class UpdateLegacyDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsEnum(CurrencyCode, {
    message: 'currency must be a valid ISO 4217 currency code',
  })
  currency?: CurrencyCode;
}
