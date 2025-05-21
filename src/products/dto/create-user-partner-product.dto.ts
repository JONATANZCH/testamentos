import { IsUUID, IsOptional } from 'class-validator';

export class CreateUserPartnerProductDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
