import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { AuthGuard } from '@nestjs/passport'; // JWT Auth Guard
import { Throttle } from '@nestjs/throttler';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('auth/register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.register(createUserDto);
  }

  @Throttle({
    short: { limit: 5, ttl: 60000 },
    medium: { limit: 20, ttl: 3600000 },
  })
  @Post('auth/login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.login(loginUserDto);
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('auth/refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.usersService.refreshSession(dto.refreshToken);
  }

  @Post('auth/logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.usersService.logout(dto.refreshToken);
  }

  // --- MFA (TOTP) — recommended for ADMIN accounts --------------------------
  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/enroll')
  async enrollMfa(@Request() req) {
    return this.usersService.enrollMfa(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/activate')
  async activateMfa(@Request() req, @Body() dto: MfaCodeDto) {
    return this.usersService.activateMfa(req.user.userId, dto.code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('mfa/disable')
  async disableMfa(@Request() req, @Body() dto: MfaCodeDto) {
    return this.usersService.disableMfa(req.user.userId, dto.code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.userId, updateUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('auth/change-password')
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.userId, changePasswordDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('profile')
  async deleteAccount(@Request() req) {
    return this.usersService.deleteAccount(req.user.userId);
  }

  @Throttle({
    short: { limit: 3, ttl: 60000 },
    medium: { limit: 10, ttl: 3600000 },
  })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(dto.email);
  }

  @Throttle({
    short: { limit: 5, ttl: 60000 },
    medium: { limit: 20, ttl: 3600000 },
  })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(dto.token, dto.newPassword);
  }
}
