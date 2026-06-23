import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Marks a (mutating) route as idempotency-aware. When a client sends an
 * `Idempotency-Key` header, a retry with the same key replays the original
 * response instead of performing the action twice (e.g. double checkout/charge).
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
