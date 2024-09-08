import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
} from 'class-validator';

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

  @IsString()
  @IsOptional()
  allergens?: string;

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
  @IsOptional()
  @IsString({ each: true }) // Ensure each item in the array is a string (URL)
  images?: string[];
}
