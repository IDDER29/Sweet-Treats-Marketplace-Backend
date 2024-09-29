// src/business-owners/dto/create-business-owner.dto.ts
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateBusinessOwnerDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  permissions: string;
}
