import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { SentryInterceptor } from './sentry.interceptor';

/**
 * Cross-cutting observability: Prometheus metrics (+ /metrics scrape endpoint)
 * and Sentry error capture, both wired as global interceptors. Global so any
 * service can inject MetricsService for business KPIs without extra imports.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
