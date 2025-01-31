import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
} from 'class-validator';

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

  @IsOptional()
  metadata?: Record<string, any>;
}
