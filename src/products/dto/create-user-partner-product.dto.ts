import { Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  registerDecorator,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';

export class MetadataItemDto {
  @IsUUID()
  contactId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

function SumNotExceed100(property: string) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'sumNotExceed100',
      target: object.constructor,
      propertyName,
      options: {
        message: 'La suma de porcentajes no debe superar el 100 %',
      },
      validator: {
        validate(value: any[]) {
          if (!Array.isArray(value)) return false;
          const total = value.reduce((acc, v) => acc + (v?.[property] ?? 0), 0);
          return total <= 100;
        },
      },
    });
  };
}

export class CreateUserPartnerProductDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MetadataItemDto)
  @SumNotExceed100('percentage')
  metadata?: MetadataItemDto[];
}
