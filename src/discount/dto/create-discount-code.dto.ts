import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { DiscountType } from '../entities/discount-code.entity';

export class CreateDiscountCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumOrderAmount?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxUsesPerCustomer?: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
