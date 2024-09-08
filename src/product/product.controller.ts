import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Req,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Request } from 'express';

declare module 'express' {
  interface Request {
    user?: {
      id: string; // Or any type that represents the user object
    };
  }
}
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Create a product
  @Post()
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: Request,
    @Headers('authorization') authorization: string, // Access user session, token, etc.
  ): Promise<Product> {
    if (!authorization) {
      throw new HttpException(
        'Authorization header is missing',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Strip 'Bearer ' and parse the stringified session
    const sessionString = authorization.replace('Bearer ', '');

    try {
      // Parse the session string into an object
      const session = JSON.parse(sessionString);

      const businessId = session?.user?.id; // Extract the `user.id` from the parsed session object
      if (!businessId) {
        throw new HttpException(
          'Business ID is missing in the token',
          HttpStatus.BAD_REQUEST,
        );
      }

      return this.productService.create(createProductDto, businessId);
    } catch (error) {
      console.error('Error parsing session:', error);
      throw new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED);
    }
  }

  // Get all products (optionally filtered by business)
  @Get()
  async findAll(@Req() req: Request): Promise<Product[]> {
    const businessId = req.user?.id; // Optional business filter
    return this.productService.findAll(businessId);
  }

  // Get a specific product by its ID
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  // Update a product
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, updateProductDto);
  }

  // Delete a product
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.productService.remove(id);
  }
}
