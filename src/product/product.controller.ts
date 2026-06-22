import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  Delete,
  Req,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { Product } from './entities/product.entity';
import { Request as ExpressRequest } from 'express';

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
    @Req() req: ExpressRequest,
  ): Promise<Product> {
    const businessId = req.user.businessId;
    return this.productService.create(createProductDto, businessId);
  }

  // Get all products with filtering and pagination
  @Get()
  async findAll(@Query() query: ProductQueryDto): Promise<any> {
    return this.productService.findAll(query);
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
    @Request() req,
  ): Promise<Product> {
    return this.productService.update(id, updateProductDto, req.user.businessId);
  }

  // Delete a product
  @UseGuards(AuthGuard('business-jwt'))
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    return this.productService.remove(id, req.user.businessId);
  }

  // Update stock for a product (business-only)
  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':id/stock')
  updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @Request() req,
  ) {
    return this.productService.updateStock(id, updateStockDto, req.user.businessId);
  }

  // Get stock info for a product (business-only)
  @UseGuards(AuthGuard('business-jwt'))
  @Get(':id/stock')
  getStock(@Param('id') id: string, @Request() req) {
    return this.productService.getStock(id, req.user.businessId);
  }

  // Reorder (or replace) the images array for a product (business-only)
  @UseGuards(AuthGuard('business-jwt'))
  @Patch(':id/images')
  reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
    @Request() req,
  ) {
    return this.productService.reorderImages(id, dto.images, req.user.businessId);
  }
}
