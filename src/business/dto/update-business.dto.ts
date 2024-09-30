// src/business/dto/update-business.dto.ts

import { IsOptional, IsString } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  business_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
