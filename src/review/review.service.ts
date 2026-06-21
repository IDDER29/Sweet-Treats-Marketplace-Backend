import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const review = this.reviewRepository.create({
      user,
      product,
      rating: dto.rating,
      comment: dto.comment,
    });
    const saved = await this.reviewRepository.save(review);

    await this.recalculateProductRating(productId);
    return this.toResponse(saved);
  }

  async findForProduct(productId: string) {
    const reviews = await this.reviewRepository.find({
      where: { product: { id: productId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map((review) => this.toResponse(review));
  }

  // Keeps the cached Product.rating / reviewCount in sync. Product.rating is an
  // int column, so the average is rounded (storing a decimal average would
  // require widening that column).
  private async recalculateProductRating(productId: string) {
    const reviews = await this.reviewRepository.find({
      where: { product: { id: productId } },
    });
    const reviewCount = reviews.length;
    const average =
      reviewCount === 0
        ? 0
        : reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;

    await this.productRepository.update(productId, {
      rating: Math.round(average),
      reviewCount,
    });
  }

  private toResponse(review: Review) {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      user: review.user
        ? {
            userId: review.user.user_id,
            firstName: review.user.first_name,
            lastName: review.user.last_name,
          }
        : undefined,
    };
  }
}
