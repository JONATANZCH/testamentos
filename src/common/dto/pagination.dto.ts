import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { CountryCode } from '../enums/country-code.enum';
import { ServiceType } from '../enums/service-type.enum';
import { CategoryType } from '../enums/category-type.enum';

export class PaginationDto {
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
  @IsEnum(ServiceType, {
    message: `type must be one of the following values: ${Object.values(ServiceType).join(', ')}`,
  })
  readonly type?: string;

  @IsOptional()
  @IsEnum(CategoryType, {
    message: `type must be one of the following values: ${Object.values(CategoryType).join(', ')}`,
  })
  readonly categoryType?: string;

  @IsOptional()
  @IsEnum(CountryCode)
  readonly country?: string;

  @IsOptional()
  @IsIn(['c', 'le'], {
    message:
      'assignmentType must be either "c" (contact) or "le" (legal entity)',
  })
  readonly assignmentType?: string;
}
