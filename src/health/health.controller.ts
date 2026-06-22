import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness vs readiness:
 * - /health/live  — the process is up (cheap; for restart decisions).
 * - /health/ready — dependencies (DB) are reachable; the load balancer gates
 *   traffic on this so a node with a dead DB connection is pulled from rotation.
 * Skipped from rate limiting because the LB polls these frequently.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
