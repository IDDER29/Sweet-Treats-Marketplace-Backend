import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  ValidateNested,
  IsInt,
  IsBoolean,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

class ImageObjectDto {
  @IsString()
  url: string;

  @IsString()
  name: string;

  @IsString()
  key: string;
}

class ReviewObjectDto {
  @IsString()
  rating: number;

  @IsString()
  comment: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  ingredients?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allergens?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  kitchenAllergens?: string[];

  @IsString()
  @IsOptional()
  dietaryLabel?: string; // New field to match the example data

  @IsNumber()
  @IsOptional()
  calories?: number; // New field to match the example data

  @IsString()
  @IsOptional()
  macronutrients?: string; // New field to match the example data

  @IsString()
  @IsOptional()
  category?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @IsOptional()
  seasonStartMonth?: number;

  @IsInt()
  @IsOptional()
  seasonEndMonth?: number;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  weight?: string; // New field to match the example data

  @IsString()
  @IsOptional()
  shelfLife?: string; // New field to match the example data

  @IsString()
  @IsOptional()
  storageInstructions?: string; // New field to match the example data

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @IsBoolean()
  @IsOptional()
  trackStock?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  leadTimeDays?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxOrderQuantity?: number;

  @IsString()
  @IsOptional()
  unitLabel?: string;

  @IsString()
  @IsOptional()
  @IsIn(['Year-round', 'Seasonal'])
  seasonalAvailability?: string; // Updated field to match the example data

  @IsString()
  @IsOptional()
  servingSuggestions?: string;

  @IsString()
  @IsOptional()
  variations?: string;

  @IsString()
  @IsOptional()
  customizationOptions?: string;

  @IsArray()
  @ValidateNested({ each: true }) // Validate each item in the array
  @Type(() => ImageObjectDto) // Use class-transformer to convert plain objects to class instances
  @IsOptional()
  images?: ImageObjectDto[];

  @IsArray()
  @ValidateNested({ each: true }) // Validate each item in the array
  @Type(() => ReviewObjectDto) // Use class-transformer to convert plain objects to class instances
  @IsOptional()
  reviews?: ReviewObjectDto[];
}
