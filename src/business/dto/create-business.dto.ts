// src/business/dto/create-business.dto.ts

import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBusinessDto {
  @IsNotEmpty()
  @IsString()
  business_name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsUUID()
  ownerId: string; // Business owner ID
}
