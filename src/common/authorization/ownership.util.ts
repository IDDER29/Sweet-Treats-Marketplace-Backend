import { ForbiddenException } from '@nestjs/common';

/**
 * The single place object-level authorization is decided.
 *
 * Replaces scattered ad-hoc `if (resource.owner.id !== principalId) throw`
 * checks so anti-IDOR (BOLA) is consistent, greppable and testable. The loaded
 * `resource` MUST include the owner relation referenced by `ownerPath`.
 *
 *   assertOwnership(product, 'business.id', principalBusinessId, 'product');
 *   assertOwnership(order, 'customer.user_id', principalUserId, 'order');
 *
 * Fails closed: a missing owner / principal throws 403, never silently passes.
 */
export function assertOwnership(
  resource: unknown,
  ownerPath: string,
  principalId: string | undefined,
  resourceName = 'resource',
): void {
  const ownerId = ownerPath
    .split('.')
    .reduce<any>((obj, key) => (obj == null ? obj : obj[key]), resource);

  if (!principalId || ownerId == null || ownerId !== principalId) {
    throw new ForbiddenException(
      `You do not have access to this ${resourceName}`,
    );
  }
}
