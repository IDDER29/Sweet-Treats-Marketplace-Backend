import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class VerifyHygieneDto {
  @IsString()
  @IsOptional()
  hygieneCertificateNumber?: string;

  @IsString()
  @IsOptional()
  hygieneCertificateExpiry?: string;

  @IsBoolean()
  verified: boolean;
}
