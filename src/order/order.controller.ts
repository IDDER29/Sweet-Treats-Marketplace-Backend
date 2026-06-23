import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Idempotent } from '../common/idempotency/idempotent.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // --- Customer endpoints (JWT-protected, reuses UserModule's strategy) ---

  @UseGuards(AuthGuard('jwt'))
  @Idempotent()
  @Post()
  checkout(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.orderService.checkout(req.user.userId, createOrderDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findMyOrders(@Request() req) {
    return this.orderService.findForCustomer(req.user.userId);
  }

  // --- Seller endpoints (must come before :id to avoid Express matching 'business' as an id param) ---

  @UseGuards(AuthGuard('business-jwt'))
  @Get('business/:businessId')
  findForBusiness(@Request() req, @Param('businessId') businessId: string) {
    return this.orderService.findForBusiness(businessId, req.user.businessId);
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':id/status')
  updateStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(
      id,
      updateOrderStatusDto.status,
      req.user.businessId,
    );
  }

  // --- Customer endpoints (continued) ---

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.orderService.findOneForCustomer(req.user.userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/cancel')
  cancel(@Request() req, @Param('id') id: string) {
    return this.orderService.cancelOwnOrder(req.user.userId, id);
  }
}
