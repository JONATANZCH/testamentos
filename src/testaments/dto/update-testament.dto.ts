import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTestamentDto {
  @IsOptional()
  @IsString()
  readonly terms?: string;

  @IsOptional()
  @IsString()
  readonly legalAdvisor?: string;

  @IsOptional()
  @IsString()
  readonly notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be one of the following: ACTIVE, INACTIVE',
  })
  readonly status?: string;
}
