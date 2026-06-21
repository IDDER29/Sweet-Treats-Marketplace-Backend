import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BusinessModule } from './business/business.module';
import { Business } from './business/entities/business.entity';
import { ProductModule } from './product/product.module';
import { Product } from './product/entities/product.entity';
import { CategoryModule } from './category/category.module';
import { Category } from './category/entities/category.entity';
import { Users } from './entities/users.entity';
import { Businesses } from './entities/businesses.entity';
import { Reviews } from './entities/reviews.entity';
import { Deliveries } from './entities/deliveries.entity';
import { Products } from './entities/products.entity';
import { Orders } from './entities/orders.entity';
import { BusinessOwners } from './entities/businessOwners.entity';
import { OrderItems } from './entities/orderItems.entity';
import { Payments } from './entities/payments.entity';
import { DeliveryPerson } from './entities/deliveryPerson.entity';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { ReviewModule } from './review/review.module';
import { PaymentModule } from './payment/payment.module';
import { DeliveryModule } from './delivery/delivery.module';
import { UploadModule } from './upload/upload.module';
import { Order } from './order/entities/order.entity';
import { OrderItem } from './order/entities/order-item.entity';
import { Review } from './review/entities/review.entity';
import { Payment } from './payment/entities/payment.entity';
import { DeliverySlot } from './delivery/entities/delivery-slot.entity';
import { DiscountModule } from './discount/discount.module';
import { DiscountCode } from './discount/entities/discount-code.entity';
import { DiscountCodeUsage } from './discount/entities/discount-code-usage.entity';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailModule } from './mail/mail.module';
@Module({
  imports: [
    // Import ConfigModule to load environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Makes the config module globally available
    }),
    // Configure TypeOrmModule using environment variables
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        Business,
        Product,
        Category,
        Users,
        Businesses,
        Reviews,
        Deliveries,
        Products,
        Orders,
        BusinessOwners,
        OrderItems,
        Payments,
        DeliveryPerson,
        Order,
        OrderItem,
        Review,
        Payment,
        DeliverySlot,
        DiscountCode,
        DiscountCodeUsage,
      ],
      synchronize: true, // Set to false in production
    }),
    BusinessModule,
    ProductModule,
    CategoryModule,
    UserModule,
    OrderModule,
    ReviewModule,
    PaymentModule,
    DeliveryModule,
    UploadModule,
    DiscountModule,
    AdminModule,
    AnalyticsModule,
    MailModule,
  ],
})
export class AppModule {}
