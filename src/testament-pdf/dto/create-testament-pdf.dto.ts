import { IsInt } from 'class-validator';

export class CreateTestamentPdfDto {
  @IsInt()
  version: number;
}
