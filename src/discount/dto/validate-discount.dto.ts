import { IsString, IsNotEmpty, IsUUID, IsNumber, Min } from 'class-validator';

export class ValidateDiscountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsUUID()
  businessId: string;

  @IsNumber()
  @Min(0)
  orderAmount: number;
}
