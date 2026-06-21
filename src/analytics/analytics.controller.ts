import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard('business-jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  getSalesOverview(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getSalesOverview(req.user.businessId, from, to);
  }

  @Get('top-products')
  getTopProducts(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getTopProducts(
      req.user.businessId,
      limit ? parseInt(limit, 10) : 10,
      from,
      to,
    );
  }

  @Get('revenue-by-day')
  getRevenueByDay(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getRevenueByDay(req.user.businessId, from, to);
  }

  @Get('order-status')
  getOrderStatusBreakdown(@Req() req: any) {
    return this.analyticsService.getOrderStatusBreakdown(req.user.businessId);
  }

  @Get('inventory')
  getInventoryReport(@Req() req: any) {
    return this.analyticsService.getInventoryReport(req.user.businessId);
  }
}
