import { CacheService } from './cache.service';

describe('CacheService', () => {
  describe('with no Redis (graceful degradation)', () => {
    const cache = new CacheService(null);

    it('reports disabled', () => {
      expect(cache.enabled).toBe(false);
    });

    it('get returns null and set/del are no-ops', async () => {
      expect(await cache.get('k')).toBeNull();
      await expect(cache.set('k', 1, 60)).resolves.toBeUndefined();
      await expect(cache.del('k')).resolves.toBeUndefined();
    });

    it('wrap always computes from source', async () => {
      const fn = jest.fn().mockResolvedValue('fresh');
      expect(await cache.wrap('k', 60, fn)).toBe('fresh');
      expect(await cache.wrap('k', 60, fn)).toBe('fresh');
      expect(fn).toHaveBeenCalledTimes(2); // no caching without Redis
    });
  });

  describe('with Redis (cache-aside)', () => {
    let store: Record<string, string>;
    let redis: any;
    let cache: CacheService;

    beforeEach(() => {
      store = {};
      redis = {
        get: jest.fn(async (k: string) => store[k] ?? null),
        set: jest.fn(async (k: string, v: string) => {
          store[k] = v;
        }),
        del: jest.fn(async (...keys: string[]) => keys.forEach((k) => delete store[k])),
      };
      cache = new CacheService(redis);
    });

    it('wrap computes once then serves from cache', async () => {
      const fn = jest.fn().mockResolvedValue({ a: 1 });
      expect(await cache.wrap('k', 60, fn)).toEqual({ a: 1 });
      expect(await cache.wrap('k', 60, fn)).toEqual({ a: 1 });
      expect(fn).toHaveBeenCalledTimes(1); // second call served from Redis
    });

    it('del invalidates', async () => {
      await cache.set('k', { a: 1 }, 60);
      await cache.del('k');
      expect(await cache.get('k')).toBeNull();
    });

    it('survives a Redis error by falling through', async () => {
      redis.get.mockRejectedValueOnce(new Error('connection lost'));
      const fn = jest.fn().mockResolvedValue('fresh');
      expect(await cache.wrap('k', 60, fn)).toBe('fresh');
    });
  });
});
