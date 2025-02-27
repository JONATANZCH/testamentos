import { IsNotEmpty, IsString } from 'class-validator';

export class ProcessTestamentPdfDto {
  @IsString()
  @IsNotEmpty()
  processId: string; // ID del registro en TestamentPdfProcess
}
