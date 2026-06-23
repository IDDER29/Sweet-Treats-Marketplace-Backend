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
import { DeliverySlot } from '../delivery/entities/delivery-slot.entity';
import { DiscountCode } from '../discount/entities/discount-code.entity';
import { Address } from '../address/entities/address.entity';
import { Driver } from '../driver/entities/driver.entity';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Users,
      Business,
      Product,
      DeliverySlot,
      DiscountCode,
      Address,
      Driver,
    ]),
    PassportModule,
    MailModule,
    NotificationModule,
  ],
  providers: [OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
