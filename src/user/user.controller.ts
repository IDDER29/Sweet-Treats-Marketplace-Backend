import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '@nestjs/passport'; // JWT Auth Guard

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('auth/register')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        }));
        throw new BadRequestException({
          message: 'Invalid input data',
          errors: messages,
        });
      },
    }),
  )
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.register(createUserDto);
    return {
      message: 'User registered successfully',
      userId: user.user_id,
      email: user.email,
    };
  }

  @Post('auth/login')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        }));
        throw new BadRequestException({
          message: 'Invalid input data',
          errors: messages,
        });
      },
    }),
  )
  async login(@Body() loginUserDto: LoginUserDto) {
    const { token, ...userInfo } = await this.usersService.login(loginUserDto);
    return {
      message: 'Login successful',
      token,
      user: userInfo,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.getProfile(req.user.userId);
    return {
      message: 'User profile retrieved successfully',
      user,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        }));
        throw new BadRequestException({
          message: 'Invalid input data',
          errors: messages,
        });
      },
    }),
  )
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const updatedUser = await this.usersService.updateProfile(
      req.user.userId,
      updateUserDto,
    );
    return {
      message: 'Profile updated successfully',
      user: updatedUser,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('auth/change-password')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        }));
        throw new BadRequestException({
          message: 'Invalid input data',
          errors: messages,
        });
      },
    }),
  )
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(req.user.userId, changePasswordDto);
    return {
      message: 'Password updated successfully',
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('profile')
  async deleteAccount(@Request() req) {
    await this.usersService.deleteAccount(req.user.userId);
    return {
      message: 'Account deleted successfully',
    };
  }
}
