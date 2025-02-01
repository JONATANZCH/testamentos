import { PartialType } from '@nestjs/mapped-types';
import { CreateTestamentDto } from './create-testament.dto';

export class UpdateTestamentDto extends PartialType(CreateTestamentDto) {}
