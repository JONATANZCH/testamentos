import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateTestamentDto {
  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  legalAdvisor?: string;

  @IsOptional()
  @IsUUID()
  contactId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
