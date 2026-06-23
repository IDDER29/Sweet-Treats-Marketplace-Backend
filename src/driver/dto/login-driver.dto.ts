import { IsEmail, MinLength } from 'class-validator';

export class LoginDriverDto {
  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;
}
