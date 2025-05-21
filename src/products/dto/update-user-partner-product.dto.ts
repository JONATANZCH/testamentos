import { PartialType } from '@nestjs/mapped-types';
import { CreateUserPartnerProductDto } from './create-user-partner-product.dto';

export class UpdateUserPartnerProductDto extends PartialType(
  CreateUserPartnerProductDto,
) {}
