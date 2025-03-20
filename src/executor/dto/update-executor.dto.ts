import { PartialType } from '@nestjs/mapped-types';
import { IsInt, Min } from 'class-validator';
import { CreateExecutorDto } from './create-executor.dto';

export class UpdateExecutorDto extends PartialType(CreateExecutorDto) {
  @IsInt()
  @Min(1, { message: 'priorityOrder must be at least 1' })
  priorityOrder?: number;
}
