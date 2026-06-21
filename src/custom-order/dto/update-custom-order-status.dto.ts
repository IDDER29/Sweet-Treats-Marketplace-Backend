import { IsEnum } from 'class-validator';
import { CustomOrderStatus } from '../entities/custom-order-request.entity';

export class UpdateCustomOrderStatusDto {
  @IsEnum(CustomOrderStatus)
  status: CustomOrderStatus;
}
