import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateExecutorDto {
  @IsNotEmpty()
  @IsUUID()
  testamentHeaderId: string;

  @IsNotEmpty()
  @IsUUID()
  contactId: string;

  @IsOptional()
  @IsString()
  @IsIn(['family', 'friend', 'professional', 'lawyer', 'accountant', 'other'], {
    message:
      'type must be family, friend, professional, lawyer, accountant, other',
  })
  type?: string;
}
