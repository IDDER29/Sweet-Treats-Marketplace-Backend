import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Product } from './entities/product.entity';
import { Business } from '../business/entities/business.entity'; // Import Business

@Module({
  imports: [TypeOrmModule.forFeature([Product, Business])], // Add Business to imports
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
