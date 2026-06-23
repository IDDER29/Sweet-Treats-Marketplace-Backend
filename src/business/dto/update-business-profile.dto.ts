import {
  IsString,
  IsOptional,
  IsUrl,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateBusinessProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  bannerUrl?: string;

  // e.g. { "mon": "9-17", "sat": "10-14", "sun": "closed" }
  @IsObject()
  @IsOptional()
  businessHours?: Record<string, string>;
}
