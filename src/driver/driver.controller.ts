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
import { DriverService } from './driver.service';
import { OrderService } from '../order/order.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { LoginDriverDto } from './dto/login-driver.dto';
import { DriverOrderStatusDto } from './dto/driver-order-status.dto';

@Controller('drivers')
export class DriverController {
  constructor(
    private readonly driverService: DriverService,
    private readonly orderService: OrderService,
  ) {}

  @Post('register')
  register(@Body() dto: CreateDriverDto) {
    return this.driverService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDriverDto) {
    return this.driverService.login(dto.email, dto.password);
  }

  @UseGuards(AuthGuard('driver'))
  @Get('me')
  me(@Request() req) {
    return this.driverService.getProfile(req.user.driverId);
  }

  @UseGuards(AuthGuard('driver'))
  @Get('me/orders')
  myOrders(@Request() req) {
    return this.orderService.findForDriver(req.user.driverId);
  }

  @UseGuards(AuthGuard('driver'))
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: DriverOrderStatusDto,
  ) {
    return this.orderService.driverUpdateStatus(
      id,
      dto.status,
      req.user.driverId,
    );
  }
}
