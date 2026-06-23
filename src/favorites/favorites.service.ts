import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { ShopFollow } from './entities/shop-follow.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(ShopFollow)
    private readonly followRepo: Repository<ShopFollow>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  async addProduct(userId: string, productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.favoriteRepo.findOne({
      where: { user: { user_id: userId }, product: { id: productId } },
    });
    if (!existing) {
      await this.favoriteRepo.save(
        this.favoriteRepo.create({
          user: { user_id: userId } as any,
          product: { id: productId } as any,
        }),
      );
      await this.bumpFavoriteCount(productId, 1);
    }
    return { favorited: true };
  }

  async removeProduct(userId: string, productId: string) {
    const existing = await this.favoriteRepo.findOne({
      where: { user: { user_id: userId }, product: { id: productId } },
    });
    if (existing) {
      await this.favoriteRepo.remove(existing);
      await this.bumpFavoriteCount(productId, -1);
    }
    return { favorited: false };
  }

  async followShop(userId: string, businessId: string) {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Shop not found');

    const existing = await this.followRepo.findOne({
      where: { user: { user_id: userId }, business: { id: businessId } },
    });
    if (!existing) {
      await this.followRepo.save(
        this.followRepo.create({
          user: { user_id: userId } as any,
          business: { id: businessId } as any,
        }),
      );
    }
    return { following: true };
  }

  async unfollowShop(userId: string, businessId: string) {
    const existing = await this.followRepo.findOne({
      where: { user: { user_id: userId }, business: { id: businessId } },
    });
    if (existing) await this.followRepo.remove(existing);
    return { following: false };
  }

  async list(userId: string) {
    const [favorites, follows] = await Promise.all([
      this.favoriteRepo.find({
        where: { user: { user_id: userId } },
        relations: ['product'],
        order: { createdAt: 'DESC' },
      }),
      this.followRepo.find({
        where: { user: { user_id: userId } },
        relations: ['business'],
        order: { createdAt: 'DESC' },
      }),
    ]);
    return {
      products: favorites
        .filter((f) => f.product)
        .map((f) => ({
          id: f.product.id,
          name: f.product.name,
          price: Number(f.product.price),
          rating: Number(f.product.rating),
          images: f.product.images,
        })),
      shops: follows
        .filter((f) => f.business)
        .map((f) => ({
          id: f.business.id,
          slug: f.business.slug,
          businessName: f.business.businessName,
          rating: Number(f.business.rating),
        })),
    };
  }

  // Atomic, never-negative count maintenance.
  private async bumpFavoriteCount(productId: string, delta: number) {
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({
        favoriteCount:
          delta >= 0
            ? () => '"favoriteCount" + 1'
            : () => 'GREATEST("favoriteCount" - 1, 0)',
      })
      .where('id = :id', { id: productId })
      .execute();
  }
}
