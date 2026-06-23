import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UseGuards, Patch, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { LoginBusinessDto } from './dto/login-business.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('register')
  async register(@Body() createBusinessDto: CreateBusinessDto) {
    try {
      return await this.businessService.create(createBusinessDto);
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const business = await this.businessService.findById(id);
      if (!business) {
        throw new NotFoundException('Business not found');
      }
      return business;
    } catch {
      throw new NotFoundException('Business not found');
    }
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    try {
      const business = await this.businessService.findByEmail(email);
      if (!business) {
        throw new NotFoundException('Business not found');
      }
      return business;
    } catch {
      throw new NotFoundException('Business not found');
    }
  }

  @Post('login')
  async login(@Body() loginBusinessDto: LoginBusinessDto) {
    try {
      return await this.businessService.login(
        loginBusinessDto.email,
        loginBusinessDto.password,
      );
    } catch (error) {
      if (error.message.includes('Invalid credentials')) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new NotFoundException('Business not found');
    }
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateBusinessProfileDto) {
    return this.businessService.updateProfile(req.user.businessId, dto);
  }

  @Post('auth/refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.businessService.refreshSession(dto.refreshToken);
  }

  @Post('auth/logout')
  async logout(@Body() dto: RefreshTokenDto) {
    return this.businessService.logout(dto.refreshToken);
  }
}
