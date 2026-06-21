import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DiscountService } from './discount.service';
import { CreateDiscountCodeDto } from './dto/create-discount-code.dto';
import { ValidateDiscountDto } from './dto/validate-discount.dto';

@Controller()
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @UseGuards(AuthGuard('business-jwt'))
  @Post('business/:businessId/discounts')
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateDiscountCodeDto,
    @Request() req,
  ) {
    return this.discountService.create(req.user.businessId, dto);
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Get('business/:businessId/discounts')
  findAll(@Param('businessId') businessId: string, @Request() req) {
    return this.discountService.findForBusiness(req.user.businessId);
  }

  @Post('discounts/validate')
  validate(@Body() dto: ValidateDiscountDto) {
    return this.discountService.validate(dto);
  }
}
