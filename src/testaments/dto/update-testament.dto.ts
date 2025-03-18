import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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

  @IsNotEmpty()
  @IsIn(['HP, HL, HU'], {
    message:
      "inheritanceType must be 'HP' (Heirs by Percentage), 'HL' (Legal Heirs) or 'HU' (Universal Heir)",
  })
  @IsString()
  inheritanceType: string;

  @IsOptional()
  @IsUUID()
  universalHeirId?: string;
}
