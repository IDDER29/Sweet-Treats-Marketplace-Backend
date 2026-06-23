import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';

@Controller('products/:productId/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  findForProduct(@Param('productId') productId: string) {
    return this.reviewService.findForProduct(productId);
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Request() req,
    @Param('productId') productId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewService.create(
      req.user.userId,
      productId,
      createReviewDto,
    );
  }

  // Seller replies to a review on their own product.
  @UseGuards(AuthGuard('business-jwt'))
  @Post(':reviewId/reply')
  reply(
    @Request() req,
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewService.addSellerReply(
      req.user.businessId,
      productId,
      reviewId,
      dto.reply,
    );
  }
}
