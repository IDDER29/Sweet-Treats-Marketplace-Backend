// src/business-owners/dto/update-business-owner.dto.ts
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateBusinessOwnerDto {
  @IsOptional()
  @IsString()
  owner_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
