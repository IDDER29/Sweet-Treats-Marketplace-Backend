import { ForbiddenException } from '@nestjs/common';
import { assertOwnership } from './ownership.util';

describe('assertOwnership', () => {
  it('passes when the principal owns the resource', () => {
    const product = { business: { id: 'b1' } };
    expect(() =>
      assertOwnership(product, 'business.id', 'b1', 'product'),
    ).not.toThrow();
  });

  it('throws when the principal does not own the resource', () => {
    const product = { business: { id: 'b1' } };
    expect(() =>
      assertOwnership(product, 'business.id', 'someone-else', 'product'),
    ).toThrow(ForbiddenException);
  });

  it('resolves nested owner paths', () => {
    const order = { customer: { user_id: 'u1' } };
    expect(() =>
      assertOwnership(order, 'customer.user_id', 'u1', 'order'),
    ).not.toThrow();
  });

  it('fails closed when the owner relation is missing', () => {
    expect(() => assertOwnership({}, 'business.id', 'b1')).toThrow(
      ForbiddenException,
    );
  });

  it('fails closed when the principal id is undefined', () => {
    const product = { business: { id: 'b1' } };
    expect(() =>
      assertOwnership(product, 'business.id', undefined),
    ).toThrow(ForbiddenException);
  });
});
