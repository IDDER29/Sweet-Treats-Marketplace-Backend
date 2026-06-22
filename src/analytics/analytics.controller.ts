import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(AuthGuard('business-jwt'))
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sales')
  getSalesOverview(@Req() req: any, @Query() q: AnalyticsQueryDto) {
    return this.analyticsService.getSalesOverview(
      req.user.businessId,
      q.from,
      q.to,
    );
  }

  @Get('top-products')
  getTopProducts(@Req() req: any, @Query() q: AnalyticsQueryDto) {
    return this.analyticsService.getTopProducts(
      req.user.businessId,
      q.limit ?? 10,
      q.from,
      q.to,
    );
  }

  @Get('revenue-by-day')
  getRevenueByDay(@Req() req: any, @Query() q: AnalyticsQueryDto) {
    return this.analyticsService.getRevenueByDay(
      req.user.businessId,
      q.from,
      q.to,
    );
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
