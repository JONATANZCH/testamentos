import { IsString, IsIn } from 'class-validator';

export class UpdateTestamentMintDto {
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be one of the following: ACTIVE, INACTIVE',
  })
  readonly status: string;
}
