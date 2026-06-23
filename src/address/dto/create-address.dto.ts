import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Length,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  label?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  recipientName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  line1: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  line2?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postcode: string;

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
