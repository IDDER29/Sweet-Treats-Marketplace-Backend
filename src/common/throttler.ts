import { Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

// Global rate-limit tiers. Defined here (not inline in app.module) so the
// skip-all helper below is derived from the same source and can't drift.
export const THROTTLER_TIERS = [
  { name: 'short', ttl: 1000, limit: 10 },
  { name: 'medium', ttl: 60000, limit: 100 },
  { name: 'long', ttl: 3600000, limit: 1000 },
];

// Pass to @SkipThrottle() to skip EVERY tier. @SkipThrottle() with no arguments
// only skips a throttler literally named 'default', which we don't define — so
// against our named tiers it is a silent no-op. This names each tier explicitly.
export const SKIP_ALL_THROTTLERS: Record<string, boolean> = Object.fromEntries(
  THROTTLER_TIERS.map((t) => [t.name, true]),
);

/**
 * Wraps a ThrottlerStorage (e.g. the Redis-backed one) so a storage outage can't
 * take down the API. If the backend throws — Redis unreachable, command timeout —
 * we FAIL OPEN: allow the request instead of 500-ing it. Losing distributed rate
 * limiting for the length of a Redis blip is far cheaper than a full outage, and
 * Redis is optional by design (ADR-0003: Redis features degrade to no-ops).
 */
export class ResilientThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ResilientThrottlerStorage.name);
  private degraded = false;

  constructor(private readonly inner: ThrottlerStorage) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const record = await this.inner.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
      if (this.degraded) {
        this.logger.log('rate-limit store recovered');
        this.degraded = false;
      }
      return record;
    } catch (err) {
      // Log once per outage window so a sustained outage doesn't flood the logs.
      if (!this.degraded) {
        this.logger.warn(
          `rate-limit store unavailable — failing open (allowing requests): ${err?.message}`,
        );
        this.degraded = true;
      }
      // A record well under any limit and not blocked → the guard allows it.
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
