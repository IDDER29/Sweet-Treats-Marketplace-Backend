import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../order/entities/order.entity';

export class DriverOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
