import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

function redisConnection() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
  };
}

/**
 * BullMQ root: one Redis connection for all queues, with sensible reliability
 * defaults — retries with exponential backoff, and failed jobs retained as a
 * dead-letter set for inspection/replay. Workers may run in-process (dev) or in
 * a dedicated worker deployment (prod) using the same code.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: redisConnection(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 1000 }, // bounded DLQ
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
