// src/business/business.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { Businesses } from '../entities/businesses.entity';
import { BusinessOwners } from '../entities/businessOwners.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Businesses, BusinessOwners]), // Import the TypeORM entities
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [TypeOrmModule, BusinessService], // Export for use in other modules if needed
})
export class BusinessModule {}
