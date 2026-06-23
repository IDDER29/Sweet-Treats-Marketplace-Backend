import { Controller, Get, Param, Query } from '@nestjs/common';
import { ShopService } from './shop.service';

// Public, unauthenticated storefront discovery.
@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  browse(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shopService.browse({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.shopService.getBySlug(slug);
  }
}
