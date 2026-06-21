import { IsUUID, IsString, IsOptional } from 'class-validator';

export class RefundPaymentDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
