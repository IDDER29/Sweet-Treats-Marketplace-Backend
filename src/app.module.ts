import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loggerConfig } from './common/logger.config';
import { HealthModule } from './health/health.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BusinessModule } from './business/business.module';
import { Business } from './business/entities/business.entity';
import { ProductModule } from './product/product.module';
import { Product } from './product/entities/product.entity';
import { CategoryModule } from './category/category.module';
import { Category } from './category/entities/category.entity';
import { Users } from './entities/users.entity';
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
import { CustomOrderModule } from './custom-order/custom-order.module';
import { CustomOrderRequest } from './custom-order/entities/custom-order-request.entity';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/entities/audit-log.entity';
import { ObservabilityModule } from './observability/observability.module';
@Module({
  imports: [
    // Import ConfigModule to load environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Makes the config module globally available
    }),
    // Structured logging (Pino) with per-request correlation ids
    LoggerModule.forRoot(loggerConfig),
    // Metrics (/metrics) + Sentry error capture (global interceptors)
    ObservabilityModule,
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
        Order,
        OrderItem,
        Review,
        Payment,
        DeliverySlot,
        DiscountCode,
        DiscountCodeUsage,
        CustomOrderRequest,
        AuditLog,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      migrations: ['dist/migrations/*.js'],
      migrationsRun: process.env.NODE_ENV === 'production',
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 100 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),
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
    CustomOrderModule,
    HealthModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
