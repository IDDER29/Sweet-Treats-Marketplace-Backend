import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;
}
