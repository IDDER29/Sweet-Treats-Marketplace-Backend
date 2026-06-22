import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Times every HTTP request into the RED histogram. Labels use the matched route
 * *pattern* (e.g. /orders/:id), never the concrete URL, so order ids don't
 * explode label cardinality.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const stopTimer = this.metrics.httpDuration.startTimer();

    const observe = (status: number) =>
      stopTimer({
        method: req.method,
        route: req.route?.path ?? 'unmatched',
        status,
      });

    return next.handle().pipe(
      tap({
        next: () => observe(res.statusCode),
        error: (err) => observe(err?.status ?? 500),
      }),
    );
  }
}
