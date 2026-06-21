import { IsEnum } from 'class-validator';
import { CustomOrderStatus } from '../entities/custom-order-request.entity';

export class RespondToQuoteDto {
  @IsEnum([CustomOrderStatus.ACCEPTED, CustomOrderStatus.DECLINED])
  decision: CustomOrderStatus.ACCEPTED | CustomOrderStatus.DECLINED;
}
