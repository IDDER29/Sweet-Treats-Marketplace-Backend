import { IsNumber, IsOptional, IsString, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitQuoteDto {
  @IsNumber()
  @Min(0)
  quotedPrice: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @IsOptional()
  businessNotes?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  quoteExpiresAt?: Date;
}
