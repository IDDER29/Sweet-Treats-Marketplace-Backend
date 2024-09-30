import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entities/users.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    private jwtService: JwtService,
  ) {}

  // Register a new user with hashed password and error handling for conflicts.
  async register(createUserDto: CreateUserDto): Promise<any> {
    try {
      const { password, email, ...userData } = createUserDto;

      // Validate if email already exists
      const existingUser = await this.usersRepository.findOne({
        where: { email },
      });
      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }

      // Hash the password with increased salt rounds for better security
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create the new user entity
      const newUser = this.usersRepository.create({
        ...userData,
        email,
        password: hashedPassword,
      });

      // Save the user to the database
      const savedUser = await this.usersRepository.save(newUser);

      // Return a success response without sensitive data
      return {
        message: 'User successfully registered',
        userId: savedUser.user_id,
        email: savedUser.email,
        created_at: savedUser.created_at,
      };
    } catch (error) {
      // Handle specific error codes
      if (error instanceof ConflictException) {
        throw new ConflictException('Email already exists');
      }

      // Handle validation or type errors
      if (error.name === 'QueryFailedError') {
        throw new BadRequestException('Invalid input data');
      }

      // Log the error for further analysis (if logging is enabled)
      console.error('Error during user registration:', error);

      // Throw a generic internal error to the client
      throw new InternalServerErrorException(
        'An error occurred during registration. Please try again later.',
      );
    }
  }
  // Log in user with token generation and better password comparison handling.
  async login(loginUserDto: LoginUserDto): Promise<any> {
    const { email, password } = loginUserDto;

    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user.user_id, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      token,
      userId: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    };
  }

  // Get user profile with error handling for not found users.
  async getProfile(userId: string): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Update user profile with basic validation.
  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<any> {
    await this.usersRepository.update(userId, updateUserDto);
    return this.getProfile(userId);
  }

  // Change user password with validation and better error handling.
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<any> {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Incorrect old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12); // Increase salt rounds for better security
    user.password = hashedPassword;
    await this.usersRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  // Delete user account with error handling for nonexistent accounts.
  async deleteAccount(userId: string): Promise<any> {
    const result = await this.usersRepository.delete(userId);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
    return { message: 'Account deleted successfully' };
  }
}
