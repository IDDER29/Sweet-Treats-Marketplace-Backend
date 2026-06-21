import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeliveryService } from './delivery.service';
import { CreateDeliverySlotDto } from './dto/create-delivery-slot.dto';
import { UpdateDeliverySlotDto } from './dto/update-delivery-slot.dto';

@Controller('business/:businessId/delivery-slots')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @UseGuards(AuthGuard('business-jwt'))
  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body() dto: CreateDeliverySlotDto,
    @Request() req,
  ) {
    if (req.user.businessId !== businessId) throw new ForbiddenException();
    return this.deliveryService.createSlot(businessId, dto);
  }

  @Get()
  findAll(
    @Param('businessId') businessId: string,
    @Query('date') date?: string,
  ) {
    return this.deliveryService.getSlotsForBusiness(businessId, date);
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':slotId')
  update(
    @Param('businessId') businessId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateDeliverySlotDto,
    @Request() req,
  ) {
    return this.deliveryService.updateSlot(req.user.businessId, slotId, dto);
  }
}
