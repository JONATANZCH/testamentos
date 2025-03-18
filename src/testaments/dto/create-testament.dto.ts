import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
export class CreateTestamentDto {
  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  legalAdvisor?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
