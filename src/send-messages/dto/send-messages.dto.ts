import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';

export class SendTestamentDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4, { message: 'You cannot send to more than 4 contacts.' })
  @IsUUID('4', { each: true })
  contactIds: string[];
}
