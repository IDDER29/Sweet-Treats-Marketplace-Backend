import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsString()
  @IsOptional()
  notes?: string;
}
