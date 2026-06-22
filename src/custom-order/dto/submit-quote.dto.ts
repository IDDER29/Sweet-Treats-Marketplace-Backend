import {
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitQuoteDto {
  @IsNumber()
  @Min(0)
  @Max(1000000)
  quotedPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1000000)
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  businessNotes?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  quoteExpiresAt?: Date;
}
