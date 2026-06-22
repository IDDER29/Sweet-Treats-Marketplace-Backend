import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

/**
 * Opaque, single-use, rotating refresh tokens stored server-side in Redis.
 *
 * - issue:  mint a token bound to a user, TTL 30d.
 * - rotate: validate + invalidate the presented token and mint a new one (so a
 *           refresh token works exactly once). An unknown token (already rotated
 *           or revoked) returns null → the caller rejects with 401.
 * - revoke: logout.
 *
 * Server-side storage means refresh tokens are revocable (unlike a stateless
 * long-lived JWT). Requires Redis; without it the refresh flow is unavailable
 * and login simply omits the refresh token (access token still works).
 */
@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds = 30 * 24 * 60 * 60; // 30 days

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  get available(): boolean {
    return !!this.redis;
  }

  private key(token: string): string {
    return `refresh:${token}`;
  }

  async issue(userId: string): Promise<string | null> {
    if (!this.redis) return null;
    const token = randomBytes(32).toString('hex');
    await this.redis.set(this.key(token), userId, 'EX', this.ttlSeconds);
    return token;
  }

  async rotate(
    token: string,
  ): Promise<{ userId: string; token: string } | null> {
    if (!this.redis || !token) return null;
    // Atomically fetch-and-delete so a token can only be redeemed once.
    const userId = await this.redis.getdel(this.key(token));
    if (!userId) return null;
    const next = await this.issue(userId);
    return next ? { userId, token: next } : null;
  }

  async revoke(token: string): Promise<void> {
    if (this.redis && token) await this.redis.del(this.key(token));
  }
}
