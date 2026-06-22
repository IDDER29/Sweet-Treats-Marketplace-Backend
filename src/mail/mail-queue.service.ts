import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailService } from './mail.service';
import { Order } from '../order/entities/order.entity';

export const EMAIL_QUEUE = 'email';

export type EmailJobName =
  | 'order-confirmation'
  | 'order-alert'
  | 'status-update';

/**
 * Producer for order emails. Enqueues onto the `email` queue (retries + DLQ via
 * BullMQ). If the queue is unavailable (no Redis) or the enqueue fails, it falls
 * back to an inline, error-swallowing send so a mail issue never breaks checkout.
 */
@Injectable()
export class MailQueueService {
  private readonly logger = new Logger(MailQueueService.name);

  constructor(
    @Optional() @InjectQueue(EMAIL_QUEUE) private readonly queue: Queue | undefined,
    private readonly mail: MailService,
  ) {}

  // Minimal serialisable order for the email templates.
  private slim(order: Order) {
    return {
      id: order.id,
      currency: order.currency,
      totalAmount: order.totalAmount,
      status: order.status,
      items: (order.items || []).map((i) => ({
        product: { name: i.product?.name },
        quantity: i.quantity,
      })),
    };
  }

  orderConfirmation(order: Order, email: string, name: string) {
    return this.dispatch(
      'order-confirmation',
      { order: this.slim(order), email, name },
      () => this.mail.sendOrderConfirmation(order, email, name),
    );
  }

  orderAlert(order: Order, email: string) {
    return this.dispatch(
      'order-alert',
      { order: this.slim(order), email },
      () => this.mail.sendOrderAlert(order, email),
    );
  }

  statusUpdate(order: Order, email: string, name: string) {
    return this.dispatch(
      'status-update',
      { order: this.slim(order), email, name },
      () => this.mail.sendStatusUpdate(order, email, name),
    );
  }

  private async dispatch(
    name: EmailJobName,
    data: Record<string, unknown>,
    fallback: () => Promise<void>,
  ): Promise<void> {
    if (!this.queue) return fallback();
    try {
      await this.queue.add(name, data);
    } catch (err) {
      this.logger.warn(
        `enqueue ${name} failed (${err.message}); sending inline instead`,
      );
      await fallback();
    }
  }
}
