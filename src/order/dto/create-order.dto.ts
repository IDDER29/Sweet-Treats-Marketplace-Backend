import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType } from '../entities/order.entity';

export class OrderItemInput {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  // A saved Address id; resolved + snapshotted server-side at checkout.
  @IsUUID()
  @IsOptional()
  addressId?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  giftMessage?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  requestedDeliveryDate?: string;

  @IsUUID()
  @IsOptional()
  deliverySlotId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFee?: number;

  @IsEnum(FulfillmentType)
  @IsOptional()
  fulfillmentType?: FulfillmentType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tipAmount?: number;

  @IsString()
  @IsOptional()
  discountCode?: string;

  @IsUUID()
  @IsOptional()
  discountCodeId?: string;
}
