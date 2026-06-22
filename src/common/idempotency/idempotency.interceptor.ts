import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type Redis from 'ioredis';
import { Observable, of, throwError } from 'rxjs';
import { concatMap, catchError } from 'rxjs/operators';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { IDEMPOTENT_KEY } from './idempotent.decorator';

const PROCESSING = '__processing__';
const TTL_SECONDS = 24 * 60 * 60;

/**
 * Replays the stored response for a repeated `Idempotency-Key` on routes marked
 * @Idempotent (e.g. checkout, payment-intent creation), so a client retry never
 * double-acts. Keyed per authenticated principal + route + key.
 *
 * - First request: acquires a lock (SET NX), runs the handler, stores the
 *   {status, body}, and on failure releases the lock so a genuine retry works.
 * - Concurrent duplicate (lock held, not yet completed): 409.
 * - Completed duplicate: the original response is replayed.
 * - No header, or no Redis: passes through unchanged (idempotency is opt-in).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const enabled = this.reflector.get<boolean>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );
    if (!enabled || !this.redis || context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const headerKey = req.headers['idempotency-key'];
    const key = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    if (!key) return next.handle();

    const principal = req.user?.userId ?? req.user?.businessId ?? 'anon';
    const redisKey = `idem:${principal}:${req.method}:${req.route?.path}:${key}`;

    const acquired = await this.redis.set(
      redisKey,
      PROCESSING,
      'EX',
      TTL_SECONDS,
      'NX',
    );

    if (!acquired) {
      const stored = await this.redis.get(redisKey);
      if (stored && stored !== PROCESSING) {
        const { status, body } = JSON.parse(stored);
        res.status(status);
        return of(body); // replay original response
      }
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed',
      );
    }

    return next.handle().pipe(
      concatMap(async (body) => {
        await this.redis!.set(
          redisKey,
          JSON.stringify({ status: res.statusCode, body }),
          'EX',
          TTL_SECONDS,
        );
        return body;
      }),
      catchError((err) => {
        // Release the lock so the client can legitimately retry after a failure.
        this.redis!.del(redisKey).catch(() => undefined);
        return throwError(() => err);
      }),
    );
  }
}
