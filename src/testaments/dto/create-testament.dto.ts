import { IsString, IsOptional } from 'class-validator';

export class CreateTestamentDto {
  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  legalAdvisor?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
