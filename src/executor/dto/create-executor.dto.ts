import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateExecutorDto {
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

  @IsNotEmpty()
  @IsInt()
  @Min(1, { message: 'priorityOrder must be at least 1' })
  priorityOrder: number;
}
