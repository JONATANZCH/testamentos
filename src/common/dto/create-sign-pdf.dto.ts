import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SignProcessType {
  WILL = 'will',
  INSURANCE = 'insurance',
}

export class ProcessToSignItemDto {
  @IsEnum(SignProcessType, {
    message: 'type must be either "will" or "insurance"',
  })
  type: SignProcessType;

  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CreateSignPdfDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'processtosign no debe estar vacío' })
  @ValidateNested({ each: true })
  @Type(() => ProcessToSignItemDto)
  processtosign: ProcessToSignItemDto[];
}
