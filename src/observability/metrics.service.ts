import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
} from 'prom-client';

/**
 * Prometheus metrics registry. Exposes:
 *  - default Node/process metrics (memory, GC, event-loop lag, ...)
 *  - http_request_duration_seconds — RED (Rate/Errors/Duration) for every route
 *  - a couple of business counters (orders, GMV) as the pattern to extend
 *
 * Each instance owns an isolated Registry, so multiple app instances (e.g. the
 * e2e suites) never clash on metric registration.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<string>;
  readonly ordersCreated: Counter<string>;
  readonly gmv: Counter<string>;

  constructor() {
    this.registry.setDefaultLabels({ app: 'sweet-treats-api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds by method, route and status',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.ordersCreated = new Counter({
      name: 'orders_created_total',
      help: 'Orders successfully created at checkout',
      registers: [this.registry],
    });

    this.gmv = new Counter({
      name: 'order_value_gbp_total',
      help: 'Cumulative gross merchandise value (order totals) in GBP',
      registers: [this.registry],
    });
  }

  /** Business KPI hook — called from checkout on a successful order. */
  recordOrderCreated(totalAmount: number): void {
    this.ordersCreated.inc();
    if (Number.isFinite(totalAmount) && totalAmount > 0) {
      this.gmv.inc(totalAmount);
    }
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
