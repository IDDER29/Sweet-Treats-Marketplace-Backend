import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('intent')
  createIntent(@Request() req, @Body() dto: CreatePaymentIntentDto) {
    return this.paymentService.createPaymentIntent(req.user.userId, dto);
  }

  // Raw body required for Stripe signature verification — enabled in main.ts via rawBody: true
  @SkipThrottle()
  @Post('webhook')
  handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentService.handleWebhook(signature, req.rawBody);
  }

  @UseGuards(AuthGuard('business-jwt'))
  @Post('refund')
  refund(@Request() req, @Body() dto: RefundPaymentDto) {
    return this.paymentService.refund(req.user.businessId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':orderId')
  getStatus(@Request() req, @Param('orderId') orderId: string) {
    return this.paymentService.getPaymentStatus(req.user.userId, orderId);
  }
}
