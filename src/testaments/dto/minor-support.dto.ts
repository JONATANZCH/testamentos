import { IsUUID, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RoleDto {
  @IsUUID()
  main: string;

  @IsOptional()
  @IsUUID()
  substitute?: string;
}

export class UpdateMinorSupportDto {
  @ValidateNested()
  @Type(() => RoleDto)
  tutor: RoleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RoleDto)
  guardian?: RoleDto;
}
