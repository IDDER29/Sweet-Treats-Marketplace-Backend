import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Product } from './entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { Category } from '../category/entities/category.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Business, Category]), StorageModule],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
