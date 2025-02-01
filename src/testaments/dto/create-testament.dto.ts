import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateTestamentDto {
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  lawyer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
