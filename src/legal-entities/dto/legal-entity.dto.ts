import { IsUUID, IsString, IsOptional } from 'class-validator';

export class LegalEntityDto {
  @IsUUID()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  cause?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
