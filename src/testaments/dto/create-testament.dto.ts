import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateTestamentDto {
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
