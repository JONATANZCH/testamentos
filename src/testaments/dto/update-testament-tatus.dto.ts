import { IsString, IsIn } from 'class-validator';

export class UpdateTestamentStatusDto {
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be one of the following: ACTIVE, INACTIVE',
  })
  readonly status: string;
}
