import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { FulfillmentType } from '../../order/entities/order.entity';

// Checkout the active cart: same delivery/discount inputs as a direct order,
// minus `items` (those come from the cart).
export class CartCheckoutDto {
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

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
}
