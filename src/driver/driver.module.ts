import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { Driver } from './entities/driver.entity';
import { DriverService } from './driver.service';
import { DriverController } from './driver.controller';
import { DriverJwtStrategy } from './strategies/driver-jwt.strategy';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'mySecretKey',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    OrderModule,
  ],
  providers: [DriverService, DriverJwtStrategy],
  controllers: [DriverController],
})
export class DriverModule {}
