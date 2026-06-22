import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Sentry } from './sentry';

/**
 * Reports server-side faults (5xx / non-HttpException) to Sentry, then re-throws
 * so Nest's default exception handling produces the response exactly as before —
 * this interceptor never changes what the client receives. 4xx are client
 * errors and are intentionally not reported as incidents.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err) => {
        const status =
          err instanceof HttpException ? err.getStatus() : 500;
        if (status >= 500 && process.env.SENTRY_DSN) {
          Sentry.captureException(err);
        }
        return throwError(() => err);
      }),
    );
  }
}
