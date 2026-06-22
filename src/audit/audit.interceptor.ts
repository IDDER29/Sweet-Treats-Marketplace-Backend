import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';
import { AuditService } from './audit.service';

// Fields that must never be persisted into audit metadata.
const SENSITIVE = new Set([
  'password',
  'oldPassword',
  'newPassword',
  'token',
  'secret',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();

    // Record only after the handler succeeds (no audit row for a rejected
    // action), and await the write so the trail is durable before we respond.
    // record() swallows its own errors, so a DB blip on audit never fails the
    // user-facing action.
    return next.handle().pipe(
      concatMap(async (data) => {
        await this.audit.record({
          action: meta.action,
          resourceType: meta.resourceType,
          resourceId: req.params?.[meta.idParam ?? 'id'] ?? null,
          actorId: req.user?.userId ?? req.user?.businessId ?? null,
          actorRole: req.user?.role ?? null,
          ip: req.ip ?? req.socket?.remoteAddress ?? null,
          metadata: meta.includeBody ? this.scrub(req.body) : null,
        });
        return data;
      }),
    );
  }

  private scrub(
    body: Record<string, unknown> | undefined,
  ): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!SENSITIVE.has(k)) out[k] = v;
    }
    return out;
  }
}
