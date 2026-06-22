import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit:meta';

export interface AuditMeta {
  action: string;
  resourceType: string;
  /** Route param holding the resource id (default 'id'). */
  idParam?: string;
  /** Record the (whitelisted, non-sensitive) request body as metadata. */
  includeBody?: boolean;
}

/**
 * Mark a controller handler as audited. The AuditInterceptor writes an AuditLog
 * row after the handler succeeds.
 *
 *   @Audit({ action: 'business.suspend', resourceType: 'Business', includeBody: true })
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
