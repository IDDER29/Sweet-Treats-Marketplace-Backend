import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsIn,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateDeliverySlotDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  slotStart: string;

  @IsString()
  @IsNotEmpty()
  slotEnd: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsIn(['DELIVERY', 'COLLECTION'])
  @IsOptional()
  type?: string;
}
