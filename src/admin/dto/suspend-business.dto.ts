import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SuspendBusinessDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason: string;
}
