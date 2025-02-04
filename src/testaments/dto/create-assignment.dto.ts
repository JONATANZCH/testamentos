import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsUUID,
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
  @IsUUID()
  readonly assignmentTypeId: string;

  @IsOptional()
  @IsString()
  readonly beneficiaryContactId?: string;

  @IsOptional()
  @IsString()
  readonly notes?: string;
}
