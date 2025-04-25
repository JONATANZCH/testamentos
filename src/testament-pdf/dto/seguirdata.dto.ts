import { Type } from 'class-transformer';
import { IsInt, NotEquals } from 'class-validator';

export class ValidateSeguridataProcessIdDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  seguridataprocessId: number;
}
