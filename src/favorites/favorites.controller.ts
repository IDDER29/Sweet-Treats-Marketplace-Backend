import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';

@UseGuards(AuthGuard('jwt'))
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Request() req) {
    return this.favorites.list(req.user.userId);
  }

  @Post('products/:productId')
  addProduct(@Request() req, @Param('productId') productId: string) {
    return this.favorites.addProduct(req.user.userId, productId);
  }

  @Delete('products/:productId')
  removeProduct(@Request() req, @Param('productId') productId: string) {
    return this.favorites.removeProduct(req.user.userId, productId);
  }

  @Post('shops/:businessId')
  followShop(@Request() req, @Param('businessId') businessId: string) {
    return this.favorites.followShop(req.user.userId, businessId);
  }

  @Delete('shops/:businessId')
  unfollowShop(@Request() req, @Param('businessId') businessId: string) {
    return this.favorites.unfollowShop(req.user.userId, businessId);
  }
}
