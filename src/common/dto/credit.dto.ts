import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class GetCreditQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['willCard', 'credit', 'b2b'])
  type: string;
}
