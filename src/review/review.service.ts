import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Users } from '../entities/users.entity';
import { Product } from '../product/entities/product.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
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
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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

    // Verified purchase: the customer must have a paid (non-pending,
    // non-cancelled) order containing this product.
    const purchased = await this.orderRepository.findOne({
      where: {
        customer: { user_id: userId },
        status: In([
          OrderStatus.PAID,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ]),
        items: { product: { id: productId } },
      },
    });
    if (!purchased) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }

    // One review per customer per product.
    const existing = await this.reviewRepository.findOne({
      where: { user: { user_id: userId }, product: { id: productId } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
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

  // Keeps the cached Product.rating / reviewCount in sync. Product.rating is a
  // decimal(3,2) column, so the average is stored to two decimal places.
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
      rating: Number(average.toFixed(2)),
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
