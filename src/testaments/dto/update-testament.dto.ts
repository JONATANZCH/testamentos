import { IsOptional, IsString } from 'class-validator';

export class UpdateTestamentDto {
  @IsOptional()
  @IsString()
  readonly terms?: string;

  @IsOptional()
  @IsString()
  readonly legalAdvisor?: string;

  @IsOptional()
  @IsString()
  readonly contactId?: string;

  @IsOptional()
  @IsString()
  readonly notes?: string;

  @IsOptional()
  @IsString()
  readonly status?: string;
}
