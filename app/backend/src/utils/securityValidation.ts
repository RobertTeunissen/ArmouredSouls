/**
 * @module utils/securityValidation
 *
 * Centralized Zod validation primitives for security-critical input fields.
 * Route schemas import these instead of defining inline regex checks.
 *
 * @see Requirements 1.4, 5.1, 5.2, 5.3, 5.6, 9.2
 */

import { z } from 'zod';

/**
 * Safe name: letters, numbers, spaces, hyphens, underscores, apostrophes, periods, exclamation marks.
 * Used for robot names and other user-visible name fields.
 */
export const safeName = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9 _\-'.!]+$/, 'Contains disallowed characters');

/**
 * Safe slug: alphanumeric, hyphens, underscores only.
 * Prevents path traversal via .., /, or encoded sequences.
 */
export const safeSlug = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid slug format');

/** Positive integer ID (coerced from string or number input). */
export const positiveInt = z.coerce.number().int().positive();

/**
 * Positive integer from a string URL parameter.
 * Rejects non-numeric strings, zero, negative, and floats at the regex level
 * before transforming to a number.
 */
export const positiveIntParam = z
  .string()
  .regex(/^\d+$/, 'Must be a positive integer')
  .transform(Number)
  .pipe(z.number().int().positive());

/**
 * Safe image URL: only HTTPS protocol with a valid domain and path.
 * Rejects javascript:, data:, path traversal (../), and non-HTTPS protocols.
 * The refine step explicitly blocks ".." sequences in the path component.
 */
export const safeImageUrl = z
  .string()
  .regex(
    /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[a-zA-Z0-9/_.-]+$/,
    'Invalid image URL format',
  )
  .refine((url) => !url.includes('..'), { message: 'Path traversal sequences not allowed' })
  .optional();

/**
 * ORDER BY column allowlist factory.
 * Maps user input to a predefined set of allowed column names.
 * Falls back to a safe default when the input doesn't match.
 */
export function orderByColumn<T extends readonly string[]>(
  allowed: T,
  defaultCol: T[number],
): z.ZodType<T[number]> {
  return z
    .string()
    .optional()
    .transform((val) => {
      if (!val || !(allowed as readonly string[]).includes(val)) return defaultCol;
      return val as T[number];
    }) as z.ZodType<T[number]>;
}

/**
 * Enum value validator factory.
 * Restricts input to one of the provided string values.
 */
export function safeEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

/**
 * Reusable pagination query schema for list endpoints.
 * Uses z.coerce.number() because query params arrive as strings.
 */
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
});

/**
 * Stable name: letters, numbers, spaces, hyphens, underscores.
 * Used for player stable names (public display names).
 */
export const stableName = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9 _-]+$/, 'Contains disallowed characters');
