import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Users } from '../entities/users.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Users, Business, Product]),
    PassportModule,
  ],
  providers: [OrderService],
  controllers: [OrderController],
})
export class OrderModule {}
