import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

/**
 * Opaque, single-use, rotating refresh tokens with **reuse-detection**, stored
 * server-side in Redis (OAuth 2.0 Security BCP, RFC 9700 §4.14.2).
 *
 * Every login starts a token *family*. Each refresh rotates the presented token
 * for a new one in the same family and marks the old token `used` (it is kept,
 * not deleted, so a replay is detectable):
 *
 * - issue:  start a new family, mint its first token (TTL 30d).
 * - rotate: if the token is `active` → mark it `used`, mint the next token in the
 *           family. If the token is already `used` → this is a **replay**, which
 *           means the token was likely stolen, so the **entire family is revoked**
 *           (every outstanding token in the chain is killed) and the caller gets
 *           a 401 — forcing a fresh login. Unknown/expired tokens just return null.
 * - revoke: logout — kills the whole family for that session.
 *
 * Server-side storage makes refresh tokens revocable (unlike a stateless
 * long-lived JWT). Requires Redis; without it the refresh flow is unavailable and
 * login simply omits the refresh token (the access token still works).
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly ttlSeconds = 30 * 24 * 60 * 60; // 30 days

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  get available(): boolean {
    return !!this.redis;
  }

  private tokenKey(token: string): string {
    return `rt:tok:${token}`;
  }
  private familyKey(familyId: string): string {
    return `rt:fam:${familyId}`;
  }
  private familyMembersKey(familyId: string): string {
    return `rt:fam:${familyId}:members`;
  }

  /** Start a new family (fresh login) and mint its first token. */
  async issue(userId: string): Promise<string | null> {
    return this.issueInFamily(userId, randomBytes(16).toString('hex'));
  }

  private async issueInFamily(
    userId: string,
    familyId: string,
  ): Promise<string | null> {
    if (!this.redis) return null;
    const token = randomBytes(32).toString('hex');
    await this.redis
      .multi()
      .set(this.tokenKey(token), `${userId}|${familyId}|active`, 'EX', this.ttlSeconds)
      .set(this.familyKey(familyId), userId, 'EX', this.ttlSeconds)
      .sadd(this.familyMembersKey(familyId), token)
      .expire(this.familyMembersKey(familyId), this.ttlSeconds)
      .exec();
    return token;
  }

  /**
   * Atomically inspect a token and, if it is `active`, flip it to `used` in one
   * step (so two concurrent rotations can't both succeed). Returns a status code
   * plus the stored value:
   *   0 = unknown/expired, 1 = was active (now used), 2 = replay (already used).
   */
  private static readonly ROTATE_LUA = `
    local v = redis.call('GET', KEYS[1])
    if not v then return {0, ''} end
    if string.match(v, '|used$') then return {2, v} end
    local ttl = redis.call('TTL', KEYS[1])
    if ttl < 0 then ttl = tonumber(ARGV[1]) end
    local nv = string.gsub(v, '|active$', '|used')
    redis.call('SET', KEYS[1], nv, 'EX', ttl)
    return {1, v}
  `;

  async rotate(
    token: string,
  ): Promise<{ userId: string; token: string } | null> {
    if (!this.redis || !token) return null;

    const [code, value] = (await this.redis.eval(
      RefreshTokenService.ROTATE_LUA,
      1,
      this.tokenKey(token),
      String(this.ttlSeconds),
    )) as [number, string];

    if (code === 0) return null; // unknown or expired

    const [userId, familyId] = value.split('|');

    if (code === 2) {
      // A token that was already rotated is being presented again: treat as a
      // compromise and burn the whole family so the attacker AND the victim are
      // forced to re-authenticate.
      this.logger.warn(
        `Refresh token reuse detected (family ${familyId}) — revoking family`,
      );
      await this.revokeFamily(familyId);
      return null;
    }

    // code === 1: token was active and is now marked used. The family must still
    // be valid (a concurrent reuse could have just revoked it).
    const familyAlive = await this.redis.exists(this.familyKey(familyId));
    if (!familyAlive) return null;

    const next = await this.issueInFamily(userId, familyId);
    return next ? { userId, token: next } : null;
  }

  /** Logout: revoke the entire family this token belongs to. */
  async revoke(token: string): Promise<void> {
    if (!this.redis || !token) return;
    const value = await this.redis.get(this.tokenKey(token));
    if (!value) return;
    const familyId = value.split('|')[1];
    await this.revokeFamily(familyId);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    if (!this.redis) return;
    const members = await this.redis.smembers(this.familyMembersKey(familyId));
    const multi = this.redis.multi();
    for (const m of members) multi.del(this.tokenKey(m));
    multi.del(this.familyMembersKey(familyId));
    multi.del(this.familyKey(familyId));
    await multi.exec();
  }
}
