import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsArray,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCustomOrderDto {
  @IsString()
  @MaxLength(2000)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  itemType?: string;

  @IsDateString()
  @IsOptional()
  requestedDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  servings?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  dietaryRequirements?: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  referenceImages?: string[];

  @IsString()
  @IsOptional()
  deliveryAddress?: string;
}
