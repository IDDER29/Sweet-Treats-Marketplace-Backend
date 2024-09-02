import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';

@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('register')
  async register(@Body() createBusinessDto: CreateBusinessDto) {
    try {
      const business =
        await this.businessService.registerBusiness(createBusinessDto);
      return business;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
