import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loggerConfig } from './common/logger.config';
import { HealthModule } from './health/health.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import type Redis from 'ioredis';
import { THROTTLER_TIERS, ResilientThrottlerStorage } from './common/throttler';
import { RedisModule, REDIS_CLIENT } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { BusinessModule } from './business/business.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { ReviewModule } from './review/review.module';
import { PaymentModule } from './payment/payment.module';
import { PayoutsModule } from './payouts/payouts.module';
import { DeliveryModule } from './delivery/delivery.module';
import { UploadModule } from './upload/upload.module';
import { DiscountModule } from './discount/discount.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailModule } from './mail/mail.module';
import { CustomOrderModule } from './custom-order/custom-order.module';
import { CartModule } from './cart/cart.module';
import { AddressModule } from './address/address.module';
import { ShopModule } from './shop/shop.module';
import { NotificationModule } from './notification/notification.module';
import { FavoritesModule } from './favorites/favorites.module';
import { DriverModule } from './driver/driver.module';
import { MessagingModule } from './messaging/messaging.module';
import { AuditModule } from './audit/audit.module';
import { ObservabilityModule } from './observability/observability.module';
import { buildTypeOrmOptions } from './common/typeorm.config';
import { APP_FILTER } from '@nestjs/core';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { QueryFailedExceptionFilter } from './common/filters/query-failed.filter';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
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
    // Configure TypeOrmModule from env. Supports optional read replicas
    // (DB_REPLICA_HOSTS) via buildTypeOrmOptions — see src/common/typeorm.config.ts.
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
    RedisModule,
    QueueModule,
    // Distributed rate limiting: counters live in Redis (shared client) so
    // limits hold across all API replicas — in-memory storage would let each
    // replica allow the full quota. Falls back to in-memory without Redis.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null) => ({
        throttlers: THROTTLER_TIERS,
        // Redis-backed so limits hold across replicas, but wrapped to fail open:
        // if Redis is down, allow requests instead of 500-ing the whole API.
        storage: redis
          ? new ResilientThrottlerStorage(
              new ThrottlerStorageRedisService(redis),
            )
          : undefined,
        // Skip rate limiting under the test runner so functional e2e suites
        // (which make many logins) aren't throttled; prod/dev are unaffected.
        skipIf: () => process.env.NODE_ENV === 'test',
      }),
    }),
    BusinessModule,
    ProductModule,
    CategoryModule,
    UserModule,
    OrderModule,
    ReviewModule,
    PaymentModule,
    PayoutsModule,
    DeliveryModule,
    UploadModule,
    DiscountModule,
    AdminModule,
    AnalyticsModule,
    MailModule,
    CustomOrderModule,
    CartModule,
    AddressModule,
    ShopModule,
    NotificationModule,
    FavoritesModule,
    DriverModule,
    MessagingModule,
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
    {
      provide: APP_FILTER,
      useClass: QueryFailedExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
