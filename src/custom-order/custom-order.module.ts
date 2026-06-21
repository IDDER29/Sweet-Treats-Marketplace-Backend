import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { CustomOrderRequest } from './entities/custom-order-request.entity';
import { Users } from '../entities/users.entity';
import { Business } from '../business/entities/business.entity';
import { CustomOrderService } from './custom-order.service';
import { CustomOrderController } from './custom-order.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomOrderRequest, Users, Business]),
    PassportModule,
  ],
  providers: [CustomOrderService],
  controllers: [CustomOrderController],
})
export class CustomOrderModule {}
