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

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('businesses')
  getAllBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllBusinesses(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
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
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('orders')
  getAllOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllOrders(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
