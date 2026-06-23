import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';

// Public read model for seller storefronts. Never exposes seller credentials.
@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async browse(query: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const qb = this.businessRepository
      .createQueryBuilder('b')
      .where('(b.isSuspended = false OR b.isSuspended IS NULL)')
      .andWhere('b.slug IS NOT NULL');
    if (query.search) {
      qb.andWhere('b.businessName ILIKE :s', { s: `%${query.search}%` });
    }
    qb.orderBy('b.rating', 'DESC')
      .addOrderBy('b.reviewCount', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((b) => this.publicProfile(b)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBySlug(slug: string) {
    const business = await this.businessRepository.findOne({
      where: { slug },
    });
    if (!business || business.isSuspended) {
      throw new NotFoundException('Shop not found');
    }
    const products = await this.productRepository.find({
      where: { business: { id: business.id }, isActive: true },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return {
      ...this.publicProfile(business),
      isAcceptingOrders: business.isAcceptingOrders,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        rating: Number(p.rating),
        reviewCount: p.reviewCount,
        images: p.images,
        isActive: p.isActive,
      })),
    };
  }

  private publicProfile(b: Business) {
    return {
      id: b.id,
      slug: b.slug,
      businessName: b.businessName,
      businessType: b.businessType,
      description: b.description ?? null,
      logoUrl: b.logoUrl ?? null,
      bannerUrl: b.bannerUrl ?? null,
      businessHours: b.businessHours ?? null,
      rating: Number(b.rating),
      reviewCount: b.reviewCount,
      hygieneCertificateVerified: b.hygieneCertificateVerified,
    };
  }
}
