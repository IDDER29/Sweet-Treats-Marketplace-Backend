import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Request } from 'express';

declare module 'express' {
  interface Request {
    user?: {
      businessId: string;
    };
  }
}

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Create a product
  @UseGuards(AuthGuard('business-jwt'))
  @Post()
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: Request,
  ): Promise<Product> {
    const businessId = req.user.businessId;
    return this.productService.create(createProductDto, businessId);
  }

  // Get all products (optionally filtered by business)
  @Get()
  async findAll(@Req() req: Request): Promise<Product[]> {
    const businessId = req.user?.businessId;
    return this.productService.findAll(businessId);
  }

  // Get a specific product by its ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  // Update a product
  @UseGuards(AuthGuard('business-jwt'))
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, updateProductDto);
  }

  // Delete a product
  @UseGuards(AuthGuard('business-jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.productService.remove(id);
  }
}
