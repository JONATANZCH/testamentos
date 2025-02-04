import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TestamentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly limit: number = 10;

  @IsOptional()
  @IsString()
  readonly status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly version?: number;
}
