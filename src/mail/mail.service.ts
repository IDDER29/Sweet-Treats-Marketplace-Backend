import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Order } from '../order/entities/order.entity';

/**
 * Each email has two entry points:
 *  - sendX()        swallows errors — for inline/fire-and-forget use where a mail
 *                   failure must never break the request (e.g. checkout).
 *  - sendXOrThrow() throws on failure — for the queue processor, so BullMQ can
 *                   retry and dead-letter.
 *
 * `order` may be a full entity or a slim plain object carrying the same fields
 * (the queue serialises a slim version into the job payload).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  private orderItems(order: Order) {
    return (order.items || []).map((item) => ({
      name: item.product?.name ?? 'Item',
      quantity: item.quantity,
    }));
  }

  async sendOrderConfirmationOrThrow(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: customerEmail,
      subject: `Order Confirmed #${order.id}`,
      template: 'order-confirmation',
      context: {
        customerName,
        orderId: order.id,
        currency: (order.currency || 'GBP').toUpperCase(),
        totalAmount: Number(order.totalAmount).toFixed(2),
        items: this.orderItems(order),
      },
    });
  }

  async sendOrderConfirmation(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    try {
      await this.sendOrderConfirmationOrThrow(order, customerEmail, customerName);
    } catch (err) {
      this.logger.error(
        `Failed to send order confirmation to ${customerEmail}: ${err.message}`,
      );
    }
  }

  async sendOrderAlertOrThrow(
    order: Order,
    businessEmail: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: businessEmail,
      subject: `New Order Received #${order.id}`,
      template: 'order-alert',
      context: {
        orderId: order.id,
        currency: (order.currency || 'GBP').toUpperCase(),
        totalAmount: Number(order.totalAmount).toFixed(2),
        items: this.orderItems(order),
      },
    });
  }

  async sendOrderAlert(order: Order, businessEmail: string): Promise<void> {
    try {
      await this.sendOrderAlertOrThrow(order, businessEmail);
    } catch (err) {
      this.logger.error(
        `Failed to send order alert to ${businessEmail}: ${err.message}`,
      );
    }
  }

  async sendStatusUpdateOrThrow(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: customerEmail,
      subject: `Order #${order.id} Status Update`,
      template: 'order-status-update',
      context: { customerName, orderId: order.id, status: order.status },
    });
  }

  async sendStatusUpdate(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    try {
      await this.sendStatusUpdateOrThrow(order, customerEmail, customerName);
    } catch (err) {
      this.logger.error(
        `Failed to send status update to ${customerEmail}: ${err.message}`,
      );
    }
  }

  async sendPasswordReset(
    email: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        context: { name, resetLink },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset to ${email}: ${err.message}`,
      );
    }
  }
}
