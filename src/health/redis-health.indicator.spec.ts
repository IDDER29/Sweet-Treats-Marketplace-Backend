import { RedisHealthIndicator } from './redis-health.indicator';

describe('RedisHealthIndicator', () => {
  it("reports 'disabled' (healthy) when Redis is not configured", async () => {
    const indicator = new RedisHealthIndicator(null);
    const res = await indicator.isHealthy('redis');
    expect(res.redis.status).toBe('up'); // never fails readiness
    expect(res.redis.mode).toBe('disabled');
  });

  it("reports 'up' when PING returns PONG", async () => {
    const redis: any = { ping: jest.fn().mockResolvedValue('PONG') };
    const indicator = new RedisHealthIndicator(redis);
    const res = await indicator.isHealthy('redis');
    expect(res.redis.status).toBe('up');
    expect(res.redis.mode).toBe('up');
  });

  it("reports 'degraded' (still healthy) when PING rejects", async () => {
    const redis: any = {
      ping: jest.fn().mockRejectedValue(new Error('Connection is closed')),
    };
    const indicator = new RedisHealthIndicator(redis);
    const res = await indicator.isHealthy('redis');
    // Healthy so a Redis outage never drains the load balancer...
    expect(res.redis.status).toBe('up');
    // ...but the real state is surfaced.
    expect(res.redis.mode).toBe('degraded');
    expect(res.redis.error).toContain('Connection is closed');
  });
});
