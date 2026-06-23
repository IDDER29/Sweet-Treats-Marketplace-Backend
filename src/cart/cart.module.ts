import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../product/entities/product.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product]), OrderModule],
  providers: [CartService],
  controllers: [CartController],
})
export class CartModule {}
