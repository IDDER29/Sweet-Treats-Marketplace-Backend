import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { RolesGuard } from './guards/roles.guard';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { VerifyHygieneDto } from './dto/verify-hygiene.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('businesses')
  getAllBusinesses(@Query() q: PaginationQueryDto) {
    return this.adminService.getAllBusinesses(q.page, q.limit);
  }

  @Get('businesses/:id')
  getBusinessById(@Param('id') id: string) {
    return this.adminService.getBusinessById(id);
  }

  @Post('businesses/:id/suspend')
  suspendBusiness(
    @Param('id') id: string,
    @Body() dto: SuspendBusinessDto,
  ) {
    return this.adminService.suspendBusiness(id, dto.reason);
  }

  @Post('businesses/:id/unsuspend')
  unsuspendBusiness(@Param('id') id: string) {
    return this.adminService.unsuspendBusiness(id);
  }

  @Post('businesses/:id/verify-hygiene')
  verifyHygieneCert(
    @Param('id') id: string,
    @Body() dto: VerifyHygieneDto,
  ) {
    return this.adminService.verifyHygieneCert(id, dto);
  }

  @Get('users')
  getAllUsers(@Query() q: PaginationQueryDto) {
    return this.adminService.getAllUsers(q.page, q.limit);
  }

  @Get('orders')
  getAllOrders(@Query() q: PaginationQueryDto) {
    return this.adminService.getAllOrders(q.page, q.limit);
  }
}
