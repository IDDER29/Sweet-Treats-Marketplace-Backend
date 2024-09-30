import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { UserRole } from '../../entities/users.entity';

export class CreateUserDto {
  @IsString({ message: 'First name must be a string' })
  first_name: string;

  @IsString({ message: 'Last name must be a string' })
  last_name: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Phone number must be a string' })
  @IsOptional()
  phone_number?: string;

  @IsEnum(UserRole, { message: 'Invalid user role' })
  @IsOptional()
  role?: UserRole;
}
