import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class VerifyHygieneDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  hygieneCertificateNumber?: string;

  @IsDateString()
  @IsOptional()
  hygieneCertificateExpiry?: string;

  @IsBoolean()
  verified: boolean;
}
