import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { Category } from '../category/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private readonly storageService: StorageService,
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

    if (createProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: createProductDto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
      product.categoryRelation = category;
    }

    return this.productRepository.save(product);
  }

  // Find all products with filtering and pagination.
  // Public catalog (no businessId) only returns active products.
  // Sellers see all their own products regardless of isActive.
  async findAll(
    query: ProductQueryDto,
  ): Promise<{ data: Product[]; total: number; page: number; limit: number; totalPages: number }> {
    const {
      businessId,
      category,
      search,
      minPrice,
      maxPrice,
      dietary,
      allergenFree,
      page = 1,
      limit = 20,
      isActive,
    } = query;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.business', 'business')
      .leftJoinAndSelect('product.categoryRelation', 'category');

    // Public catalog only shows active products (sellers can query their own inactive ones)
    if (isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', { isActive });
    } else if (!businessId) {
      qb.andWhere('product.isActive = true');
    }

    if (businessId) qb.andWhere('business.id = :businessId', { businessId });
    if (category) qb.andWhere('category.slug = :category', { category });
    if (search)
      qb.andWhere(
        '(product.name ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` },
      );
    if (minPrice !== undefined)
      qb.andWhere('product.price >= :minPrice', { minPrice });
    if (maxPrice !== undefined)
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    if (dietary)
      qb.andWhere('product.dietaryLabel ILIKE :dietary', {
        dietary: `%${dietary}%`,
      });
    if (allergenFree) {
      const allergens = allergenFree.split(',').map((a) => a.trim());
      for (const allergen of allergens) {
        qb.andWhere('NOT (:allergen = ANY(product.allergens))', { allergen });
      }
    }

    // Filter out suspended businesses
    qb.andWhere(
      '(business.isSuspended = false OR business.isSuspended IS NULL)',
    );

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit).orderBy('product.createdAt', 'DESC');

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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

  // Update a product owned by the given business
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    businessId: string,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.business?.id !== businessId) {
      throw new ForbiddenException('Not your product');
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  // Remove a product by ID, owned by the given business
  async remove(id: string, businessId: string): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.business?.id !== businessId) {
      throw new ForbiddenException('Not your product');
    }

    // Delete S3 images before removing the DB record
    if (product.images?.length) {
      await Promise.allSettled(
        product.images
          .filter((img) => img.key)
          .map((img) => this.storageService.deleteObject(img.key)),
      );
    }

    await this.productRepository.remove(product);
  }

  // Reorder (or replace) the images array for a product owned by the given business
  async reorderImages(
    id: string,
    images: { url: string; name: string; key: string }[],
    businessId: string,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.business?.id !== businessId)
      throw new ForbiddenException('Not your product');
    product.images = images;
    return this.productRepository.save(product);
  }

  // Update stock for a product owned by the given business
  async updateStock(
    id: string,
    dto: UpdateStockDto,
    businessId: string,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.business?.id !== businessId) {
      throw new ForbiddenException(
        'You do not have permission to manage this product',
      );
    }

    switch (dto.operation) {
      case 'set':
        product.stockQuantity = dto.quantity;
        break;
      case 'increment':
        product.stockQuantity += dto.quantity;
        break;
      case 'decrement':
        product.stockQuantity = Math.max(0, product.stockQuantity - dto.quantity);
        break;
    }

    return this.productRepository.save(product);
  }

  // Return a lightweight stock summary for a product owned by the given business
  async getStock(
    id: string,
    businessId: string,
  ): Promise<{
    productId: string;
    name: string;
    stockQuantity: number;
    trackStock: boolean;
    isActive: boolean;
    unitLabel: string;
  }> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['business'],
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.business?.id !== businessId) {
      throw new ForbiddenException(
        'You do not have permission to view this product stock',
      );
    }

    return {
      productId: product.id,
      name: product.name,
      stockQuantity: product.stockQuantity,
      trackStock: product.trackStock,
      isActive: product.isActive,
      unitLabel: product.unitLabel,
    };
  }
}
