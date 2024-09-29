// src/business-owners/business-owners.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessOwnersService } from './business-owners.service';
import { BusinessOwnersController } from './business-owners.controller';
import { BusinessOwners } from '../entities/businessOwners.entity';
import { Users } from '../entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessOwners, Users])],
  controllers: [BusinessOwnersController],
  providers: [BusinessOwnersService],
  exports: [BusinessOwnersService],
})
export class BusinessOwnersModule {}
