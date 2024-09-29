import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

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
import { BusinessOwnersModule } from './business-owners/business-owners.module';
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
      ], // Include both Business and Product entities
      synchronize: true, // Set to false in production
    }),

    UserModule,
    BusinessOwnersModule,
  ],
})
export class AppModule {}
