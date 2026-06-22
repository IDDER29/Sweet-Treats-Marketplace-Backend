import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  // Required only when the account has MFA enabled.
  @IsOptional()
  @IsString()
  totpCode?: string;
}
