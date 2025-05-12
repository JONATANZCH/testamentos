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
  @IsIn(['HP', 'HL', 'HU', 'HPG'], {
    // Heredero porcentual, heredero legal, heredero universal, heredero porcentual global
    message:
      "inheritanceType must be 'HP' (Heirs by Percentage), 'HL' (Legal Heirs), 'HU' (Sole heir) or 'HPG' (Heirs by Percentage Global)",
  })
  @IsString()
  inheritanceType: string;

  @IsOptional()
  @IsUUID()
  universalHeirId?: string;
}
