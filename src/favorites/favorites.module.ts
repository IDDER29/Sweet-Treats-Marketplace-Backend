import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { ShopFollow } from './entities/shop-follow.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Favorite, ShopFollow, Product, Business]),
  ],
  providers: [FavoritesService],
  controllers: [FavoritesController],
})
export class FavoritesModule {}
