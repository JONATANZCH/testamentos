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

  // Agregas este campo para que se pueda actualizar el status
  @IsOptional()
  @IsString()
  readonly status?: string;
}
