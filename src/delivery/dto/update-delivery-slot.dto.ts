import { IsInt, Min, IsBoolean, IsOptional } from 'class-validator';

export class UpdateDeliverySlotDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
