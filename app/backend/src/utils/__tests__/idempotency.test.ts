import { getIdempotencyKey, idempotencyHeadersSchema } from '../idempotency';

describe('Idempotency-Key validation', () => {
  it('should accept a bounded opaque key', () => {
    const parsed = idempotencyHeadersSchema.parse({ 'idempotency-key': 'request-key-123456' });
    expect(getIdempotencyKey(parsed)).toBe('request-key-123456');
  });

  it.each(['short', 'key with spaces', 'x'.repeat(129)])('should reject malformed key %s', (key) => {
    expect(idempotencyHeadersSchema.safeParse({ 'idempotency-key': key }).success).toBe(false);
  });
});
