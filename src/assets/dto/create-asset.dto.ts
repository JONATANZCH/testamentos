import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { CurrencyCode } from '../../common/enums/currency-code.enum';

export class CreateAssetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @IsNotEmpty()
  @IsNumber()
  value: number;

  @IsNotEmpty()
  @IsEnum(CurrencyCode, {
    message: 'currency must be a valid ISO 4217 currency code',
  })
  currency: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
