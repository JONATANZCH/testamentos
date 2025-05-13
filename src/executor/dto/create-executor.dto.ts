import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateExecutorDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['family', 'friend', 'professional', 'lawyer', 'accountant', 'other'], {
    message:
      'type must be family, friend, professional, lawyer, accountant, other',
  })
  type?: string;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}
