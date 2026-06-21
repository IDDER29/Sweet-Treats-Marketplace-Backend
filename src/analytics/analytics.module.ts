import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Product } from '../product/entities/product.entity';
import { BusinessJwtStrategy } from '../business/strategies/business-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product]),
    PassportModule,
  ],
  providers: [AnalyticsService, BusinessJwtStrategy],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
