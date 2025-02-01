import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateAssignmentDto {
  @IsNotEmpty()
  @IsString()
  assetId: string;

  @IsNotEmpty()
  @IsNumber()
  percentage: number;

  @IsNotEmpty()
  @IsString()
  assignmentType: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
