import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DiscountService } from './discount.service';
import { DiscountController } from './discount.controller';
import { DiscountCode } from './entities/discount-code.entity';
import { DiscountCodeUsage } from './entities/discount-code-usage.entity';
import { Business } from '../business/entities/business.entity';
import { BusinessJwtStrategy } from '../business/strategies/business-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([DiscountCode, DiscountCodeUsage, Business]),
    PassportModule,
  ],
  providers: [DiscountService, BusinessJwtStrategy],
  controllers: [DiscountController],
  exports: [DiscountService],
})
export class DiscountModule {}
