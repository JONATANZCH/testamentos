import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateAssignmentDto {
  @IsNotEmpty()
  @IsString()
  readonly assetId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  readonly percentage: number;

  @IsNotEmpty()
  @IsString()
  readonly assignmentType: string;

  @IsOptional()
  @IsString()
  readonly beneficiaryContactId?: string;

  @IsOptional()
  @IsString()
  readonly notes?: string;
}
