import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsIn,
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
  @IsIn(['c', 'le'], {
    message: "assignmentType must be 'c' (contact) or 'le' (legal entity)",
  })
  readonly assignmentType: string;

  @IsOptional()
  @IsString()
  readonly assignmentId?: string;

  @IsOptional()
  @IsString()
  readonly notes?: string;
}
