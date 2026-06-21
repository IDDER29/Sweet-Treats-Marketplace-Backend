import { IsString, IsOptional } from 'class-validator';

export class SuspendBusinessDto {
  @IsString()
  @IsOptional()
  reason: string;
}
