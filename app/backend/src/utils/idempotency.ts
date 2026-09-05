import { z } from 'zod';

/** Bounded opaque request key accepted for durable economic replay. */
export const idempotencyHeadersSchema = z.object({
  'idempotency-key': z.string({ message: 'Idempotency-Key is required' })
    .min(16, 'Idempotency-Key must be at least 16 characters')
    .max(128, 'Idempotency-Key must be 128 characters or less')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/, 'Idempotency-Key contains invalid characters'),
}).passthrough();

export function getIdempotencyKey(headers: Record<string, unknown>): string {
  const value = headers['idempotency-key'];
  if (typeof value !== 'string') {
    throw new Error('Validated Idempotency-Key header was missing');
  }
  return value;
}
