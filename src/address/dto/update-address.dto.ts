import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  Length,
} from 'class-validator';

// All fields optional (partial update). Mirrors CreateAddressDto constraints.
export class UpdateAddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  recipientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  line1?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  line2?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postcode?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
