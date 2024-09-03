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
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';

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
    } catch (error) {
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
    } catch (error) {
      throw new NotFoundException('Business not found');
    }
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    try {
      return await this.businessService.login(email, password);
    } catch (error) {
      if (error.message.includes('Invalid credentials')) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw new NotFoundException('Business not found');
    }
  }
}
