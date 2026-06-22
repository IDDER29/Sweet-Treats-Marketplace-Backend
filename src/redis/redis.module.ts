import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

/**
 * Single shared Redis connection for the app (cache, idempotency, later: BullMQ,
 * refresh tokens). Provided globally. If REDIS_URL is unset the provider is null
 * and Redis-backed features degrade to no-ops, so the app still boots/runs
 * without Redis (graceful degradation — ADR-0003).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        const logger = new Logger('Redis');
        const url = process.env.REDIS_URL;
        if (!url) {
          logger.warn(
            'REDIS_URL not set — cache and other Redis features degrade to no-op.',
          );
          return null;
        }
        const client = new Redis(url, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        client.on('error', (e) => logger.warn(`Redis error: ${e.message}`));
        client.on('connect', () => logger.log(`Connected to Redis at ${url}`));
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly client: Redis | null,
  ) {}

  // Close the connection on shutdown so the process can exit cleanly (otherwise
  // the open socket keeps Node — and the test runner — alive).
  async onApplicationShutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }
}
