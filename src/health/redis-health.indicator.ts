import { Inject, Injectable, Optional } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const PING_TIMEOUT_MS = 1000;

/**
 * Readiness signal for Redis. Redis is optional (ADR-0003: cache and other
 * Redis-backed features degrade to no-ops without it), so this indicator NEVER
 * fails the overall readiness check — a node with no/broken Redis must stay in
 * rotation. Instead it surfaces the real state via a `mode` detail so operators
 * and dashboards can see it:
 *   - `disabled`  — REDIS_URL unset; Redis features are off by design.
 *   - `up`        — reachable, PING returned PONG.
 *   - `degraded`  — configured but unreachable/slow; app still serves traffic.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {
    super();
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    if (!this.redis) {
      return this.getStatus(key, true, { mode: 'disabled' });
    }
    try {
      const pong = await this.withTimeout(this.redis.ping());
      return this.getStatus(key, true, {
        mode: pong === 'PONG' ? 'up' : 'degraded',
      });
    } catch (err) {
      return this.getStatus(key, true, {
        mode: 'degraded',
        error: err?.message,
      });
    }
  }

  // A readiness probe must return fast; cap the PING so a hung Redis socket
  // can't stall the load balancer's health poll.
  private withTimeout<T>(p: Promise<T>): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('redis ping timed out')),
          PING_TIMEOUT_MS,
        ),
      ),
    ]);
  }
}
