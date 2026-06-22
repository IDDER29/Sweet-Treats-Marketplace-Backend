import Redis from 'ioredis';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Integration spec against a real Redis (skipped automatically when REDIS_URL is
 * absent, so CI without Redis stays green). Run locally with a Redis on :6379.
 */
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('RefreshTokenService (reuse-detection)', () => {
  let redis: Redis | null = null;
  let reachable = false;

  beforeAll(async () => {
    try {
      redis = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      await redis.connect();
      await redis.ping();
      reachable = true;
    } catch {
      reachable = false;
      if (redis) redis.disconnect();
      redis = null;
    }
  });

  afterAll(async () => {
    if (redis) await redis.quit();
  });

  const svc = () => new RefreshTokenService(redis);

  it('rotates a token (single-use) and rejects the old one', async () => {
    if (!reachable) return; // no Redis -> skip
    const s = svc();
    const t1 = await s.issue('user-1');
    expect(t1).toBeTruthy();

    const r1 = await s.rotate(t1!);
    expect(r1).not.toBeNull();
    expect(r1!.userId).toBe('user-1');
    expect(r1!.token).not.toBe(t1);

    // The original is now single-use -> rejected.
    const replay = await s.rotate(t1!);
    expect(replay).toBeNull();
  });

  it('revokes the whole family when a used token is replayed', async () => {
    if (!reachable) return;
    const s = svc();
    const t1 = await s.issue('user-2');
    const r1 = await s.rotate(t1!); // t1 -> t2
    const t2 = r1!.token;

    // Replay t1 (already used) -> reuse detected -> family burned.
    const reuse = await s.rotate(t1!);
    expect(reuse).toBeNull();

    // t2 was valid, but the family revocation must have killed it too.
    const afterBurn = await s.rotate(t2);
    expect(afterBurn).toBeNull();
  });

  it('revoke() (logout) kills the family', async () => {
    if (!reachable) return;
    const s = svc();
    const t1 = await s.issue('user-3');
    await s.revoke(t1!);
    const afterLogout = await s.rotate(t1!);
    expect(afterLogout).toBeNull();
  });

  it('rotate of an unknown token returns null', async () => {
    if (!reachable) return;
    const s = svc();
    expect(await s.rotate('deadbeef-not-a-real-token')).toBeNull();
  });

  it('degrades gracefully without Redis', async () => {
    const s = new RefreshTokenService(null);
    expect(s.available).toBe(false);
    expect(await s.issue('user-x')).toBeNull();
    expect(await s.rotate('whatever')).toBeNull();
    await expect(s.revoke('whatever')).resolves.toBeUndefined();
  });
});
