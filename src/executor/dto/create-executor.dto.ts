import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateExecutorDto {
  @IsNotEmpty()
  @IsUUID()
  testamentHeaderId: string;

  @IsNotEmpty()
  @IsUUID()
  contactId: string;

  @IsOptional()
  @IsString()
  type?: string; // Contact, legalAdvisor
}
