import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { EMAIL_QUEUE } from './mail-queue.service';

/**
 * Email queue consumer. Calls the *OrThrow send variants so a failure (SMTP
 * down, etc.) propagates and BullMQ retries with backoff; after the configured
 * attempts the job lands in the dead-letter set for inspection/replay.
 *
 * Runs in-process in dev; in production run a dedicated worker that loads this
 * processor so a mail backlog cannot starve API request handling.
 */
@Processor(EMAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { order, email, name } = job.data;
    switch (job.name) {
      case 'order-confirmation':
        return this.mail.sendOrderConfirmationOrThrow(order, email, name);
      case 'order-alert':
        return this.mail.sendOrderAlertOrThrow(order, email);
      case 'status-update':
        return this.mail.sendStatusUpdateOrThrow(order, email, name);
      default:
        this.logger.warn(`unknown email job: ${job.name}`);
    }
  }
}
