import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { SKIP_ALL_THROTTLERS } from '../common/throttler';
import { RedisHealthIndicator } from './redis-health.indicator';

/**
 * Liveness vs readiness:
 * - /health/live  — the process is up (cheap; for restart decisions).
 * - /health/ready — dependencies are reachable; the load balancer gates traffic
 *   on this so a node with a dead DB connection is pulled from rotation. The DB
 *   is a hard gate; Redis is reported but never fails readiness (it's optional —
 *   features degrade to no-ops without it), so a Redis blip won't drain the LB.
 * Skipped from rate limiting because the LB polls these frequently.
 */
@SkipThrottle(SKIP_ALL_THROTTLERS)
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
