import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
  ) {}

  // Create a product associated with a business
  async create(
    createProductDto: CreateProductDto,
    businessId: string,
  ): Promise<Product> {
    const business = await this.businessRepository.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const product = this.productRepository.create({
      ...createProductDto,
      business,
    });

    return this.productRepository.save(product);
  }

  // Find all products, optionally filtered by business
  async findAll(businessId?: string): Promise<Product[]> {
    const query = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.business', 'business');

    if (businessId) {
      query.where('business.id = :businessId', { businessId });
    }

    return query.getMany();
  }

  // Find one product by ID
  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  // Update a product
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  // Remove a product by ID
  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.productRepository.remove(product);
  }
}
