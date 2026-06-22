import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { RolesGuard } from './guards/roles.guard';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { VerifyHygieneDto } from './dto/verify-hygiene.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { Audit } from '../audit/audit.decorator';
import { AuditService } from '../audit/audit.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(AuditInterceptor)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // Action history for a resource (forensics / moderation review).
  @Get('audit/:resourceType/:resourceId')
  getAudit(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.findForResource(resourceType, resourceId);
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
  @Audit({ action: 'business.suspend', resourceType: 'Business', includeBody: true })
  suspendBusiness(@Param('id') id: string, @Body() dto: SuspendBusinessDto) {
    return this.adminService.suspendBusiness(id, dto.reason);
  }

  @Post('businesses/:id/unsuspend')
  @Audit({ action: 'business.unsuspend', resourceType: 'Business' })
  unsuspendBusiness(@Param('id') id: string) {
    return this.adminService.unsuspendBusiness(id);
  }

  @Post('businesses/:id/verify-hygiene')
  @Audit({
    action: 'business.verify_hygiene',
    resourceType: 'Business',
    includeBody: true,
  })
  verifyHygieneCert(@Param('id') id: string, @Body() dto: VerifyHygieneDto) {
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
