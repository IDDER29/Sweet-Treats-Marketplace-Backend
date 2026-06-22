import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { OrderService } from '../order/order.service';

@Injectable()
export class PaymentService {
  private readonly stripe: Stripe;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderService: OrderService,
  ) {
    // Falls back to a placeholder so the app can boot without Stripe configured
    // (dev-friendly, mirrors the JWT_SECRET fallback). Real payment calls will
    // still fail with a clear Stripe auth error until STRIPE_SECRET_KEY is set.
    this.stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
      {
        apiVersion: '2026-05-27.dahlia',
      },
    );
  }

  // Convert a decimal currency amount (e.g. order.totalAmount, stored as a
  // string by TypeORM) to integer minor units for Stripe. Rounding to the
  // nearest penny avoids IEEE-754 drift on the * 100 conversion.
  private toMinorUnits(amount: number | string): number {
    return Math.round(Number(amount) * 100);
  }

  async createPaymentIntent(customerId: string, dto: CreatePaymentIntentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: ['customer', 'business'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer.user_id !== customerId)
      throw new ForbiddenException('Not your order');
    if (order.status !== OrderStatus.PENDING)
      throw new BadRequestException('Order is not in PENDING status');

    // Check if a payment intent already exists for this order
    const existing = await this.paymentRepository.findOne({
      where: { order: { id: order.id } },
    });
    if (existing && existing.status === PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Order is already paid');
    }

    const amountInCents = this.toMinorUnits(order.totalAmount);
    if (amountInCents <= 0) {
      throw new BadRequestException(
        'Order total must be greater than zero to take payment',
      );
    }
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: order.currency || 'gbp',
      metadata: { orderId: order.id, customerId },
      description: `Order ${order.id} - ${order.business?.businessName ?? 'Sweet Treats'}`,
    });

    // Upsert payment record
    if (existing) {
      existing.stripePaymentIntentId = paymentIntent.id;
      existing.status = PaymentStatus.PENDING;
      await this.paymentRepository.save(existing);
    } else {
      const payment = this.paymentRepository.create({
        order,
        stripePaymentIntentId: paymentIntent.id,
        amount: order.totalAmount,
        currency: order.currency || 'gbp',
        status: PaymentStatus.PENDING,
      });
      await this.paymentRepository.save(payment);
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.handlePaymentSucceeded(intent);
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.handlePaymentFailed(intent);
    }

    return { received: true };
  }

  private async handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: intent.id },
      relations: ['order'],
    });
    if (!payment) return; // Unknown payment, ignore

    // Atomically claim the transition so concurrent webhook deliveries don't
    // both mark the order PAID. Only the delivery whose UPDATE actually flips a
    // non-succeeded row proceeds; the rest see affected === 0 and stop.
    const claim = await this.paymentRepository.update(
      { id: payment.id, status: Not(PaymentStatus.SUCCEEDED) },
      { status: PaymentStatus.SUCCEEDED },
    );
    if (!claim.affected) return;

    // Transition order to PAID
    await this.orderRepository.update(payment.order.id, {
      status: OrderStatus.PAID,
    });
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent) {
    const payment = await this.paymentRepository.findOne({
      where: { stripePaymentIntentId: intent.id },
    });
    if (!payment || payment.status === PaymentStatus.SUCCEEDED) return;
    payment.status = PaymentStatus.FAILED;
    await this.paymentRepository.save(payment);
  }

  async refund(requestingBusinessId: string, dto: RefundPaymentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: ['business', 'items', 'items.product'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.business?.id !== requestingBusinessId)
      throw new ForbiddenException('Not your order');

    const payment = await this.paymentRepository.findOne({
      where: { order: { id: order.id } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.SUCCEEDED)
      throw new BadRequestException('Payment not eligible for refund');

    const stripeRefund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      reason: 'requested_by_customer',
    });

    payment.status = PaymentStatus.REFUNDED;
    payment.stripeRefundId = stripeRefund.id;
    payment.refundedAt = new Date();
    await this.paymentRepository.save(payment);

    // Cancel the order and restore stock, the delivery slot, and discount usage
    // (transactional + idempotent). Previously the refund only flipped the
    // status, permanently leaking the reserved inventory and discount use.
    await this.orderService.cancelForRefund(order.id);

    return { refundId: stripeRefund.id, status: 'refunded' };
  }

  async getPaymentStatus(customerId: string, orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['customer'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customer?.user_id !== customerId)
      throw new ForbiddenException('Not your order');

    const payment = await this.paymentRepository.findOne({
      where: { order: { id: orderId } },
    });
    if (!payment) return { status: 'NO_PAYMENT', orderId };

    return {
      orderId,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      createdAt: payment.createdAt,
    };
  }
}
