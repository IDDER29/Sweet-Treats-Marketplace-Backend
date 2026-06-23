import {
  ResilientThrottlerStorage,
  SKIP_ALL_THROTTLERS,
  THROTTLER_TIERS,
} from './throttler';

describe('SKIP_ALL_THROTTLERS', () => {
  it('names every configured tier (so @SkipThrottle actually skips)', () => {
    // @SkipThrottle() with no args only skips a throttler named "default", which
    // we never define — this guards against that silent no-op regressing.
    for (const tier of THROTTLER_TIERS) {
      expect(SKIP_ALL_THROTTLERS[tier.name]).toBe(true);
    }
    expect(Object.keys(SKIP_ALL_THROTTLERS).sort()).toEqual(
      THROTTLER_TIERS.map((t) => t.name).sort(),
    );
  });
});

describe('ResilientThrottlerStorage', () => {
  it('delegates to the inner store when it works', async () => {
    const record = {
      totalHits: 3,
      timeToExpire: 1000,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
    const inner = { increment: jest.fn().mockResolvedValue(record) };
    const store = new ResilientThrottlerStorage(inner);
    const res = await store.increment('k', 1000, 10, 0, 'short');
    expect(res).toBe(record);
    expect(inner.increment).toHaveBeenCalledWith('k', 1000, 10, 0, 'short');
  });

  it('fails open (allows the request) when the inner store throws', async () => {
    const inner = {
      increment: jest.fn().mockRejectedValue(new Error('Redis down')),
    };
    const store = new ResilientThrottlerStorage(inner);
    const res = await store.increment('k', 5000, 10, 0, 'short');
    // Not blocked + hits under the limit → the guard lets the request through.
    expect(res.isBlocked).toBe(false);
    expect(res.totalHits).toBeLessThan(10);
    expect(res.timeToExpire).toBe(5000);
  });

  it('logs the outage only once until the store recovers', async () => {
    const inner = {
      increment: jest
        .fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce({
          totalHits: 1,
          timeToExpire: 1,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    };
    const store = new ResilientThrottlerStorage(inner);
    const warn = jest
      .spyOn((store as any).logger, 'warn')
      .mockImplementation(() => {});
    await store.increment('k', 1000, 10, 0, 'short'); // logs
    await store.increment('k', 1000, 10, 0, 'short'); // suppressed
    await store.increment('k', 1000, 10, 0, 'short'); // recovers
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
