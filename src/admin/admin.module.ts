import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Business } from '../business/entities/business.entity';
import { Users } from '../entities/users.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Product } from '../product/entities/product.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { RolesGuard } from './guards/roles.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Users, Order, OrderItem, Product]),
    PassportModule,
    AuditModule,
  ],
  providers: [AdminService, RolesGuard],
  controllers: [AdminController],
})
export class AdminModule {}
