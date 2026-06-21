import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendOrderConfirmation(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject: `Order Confirmed #${order.id}`,
        template: 'order-confirmation',
        context: {
          customerName,
          orderId: order.id,
          currency: (order.currency || 'GBP').toUpperCase(),
          totalAmount: Number(order.totalAmount).toFixed(2),
          items: (order.items || []).map((item) => ({
            name: item.product?.name ?? 'Item',
            quantity: item.quantity,
          })),
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send order confirmation to ${customerEmail}: ${err.message}`,
        err.stack,
      );
    }
  }

  async sendOrderAlert(order: Order, businessEmail: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: businessEmail,
        subject: `New Order Received #${order.id}`,
        template: 'order-alert',
        context: {
          orderId: order.id,
          currency: (order.currency || 'GBP').toUpperCase(),
          totalAmount: Number(order.totalAmount).toFixed(2),
          items: (order.items || []).map((item) => ({
            name: item.product?.name ?? 'Item',
            quantity: item.quantity,
          })),
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send order alert to ${businessEmail}: ${err.message}`,
        err.stack,
      );
    }
  }

  async sendStatusUpdate(
    order: Order,
    customerEmail: string,
    customerName: string,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: customerEmail,
        subject: `Order #${order.id} Status Update`,
        template: 'order-status-update',
        context: {
          customerName,
          orderId: order.id,
          status: order.status,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send status update to ${customerEmail}: ${err.message}`,
        err.stack,
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
        context: {
          name,
          resetLink,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset to ${email}: ${err.message}`,
        err.stack,
      );
    }
  }
}
