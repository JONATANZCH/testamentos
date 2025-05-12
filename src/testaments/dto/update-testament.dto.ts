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
  @IsIn(['HP', 'HL', 'HU', 'HPG'], {
    message:
      "inheritanceType must be 'HP' (Heirs by Percentage), 'HL' (Legal Heirs), 'HU' (Sole heir) or 'HPG' (Heirs by Percentage Global)",
  })
  @IsString()
  inheritanceType: string;

  @IsOptional()
  @IsUUID()
  universalHeirId?: string;
}
