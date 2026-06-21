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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('products/:productId/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  findForProduct(@Param('productId') productId: string) {
    return this.reviewService.findForProduct(productId);
  }

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
}
