import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BusinessModule } from './business/business.module';
import { Business } from './business/entities/business.entity';

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
      entities: [Business], // Point to your entities
      synchronize: true, // Set to false in production
    }),
    BusinessModule,
  ],
})
export class AppModule {}
