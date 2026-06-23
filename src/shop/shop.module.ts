import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Business, Product])],
  providers: [ShopService],
  controllers: [ShopController],
})
export class ShopModule {}
