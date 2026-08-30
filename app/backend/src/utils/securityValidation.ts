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
/**
 * Messages are deliberately generic: this primitive backs robot names, team names and
 * weapon custom names. A route that wants field-specific wording declares its own
 * schema with the canonical text — see `robotNameSchema` in `routes/robots.ts`.
 *
 * They still name the rule, because `validateRequest` puts them in the response's
 * `error` string and Zod's defaults ('Too big: expected string to have <=50
 * characters') read as internals.
 */
export const safeName = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must be 50 characters or less')
  .regex(
    /^[a-zA-Z0-9 _\-'.!]+$/,
    'Name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, periods, and exclamation marks',
  );

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
/**
 * The wording is the canonical wording from `validateStableName` in
 * `utils/validation.ts`, deliberately duplicated here rather than paraphrased.
 *
 * These messages are user-facing: `validateRequest` builds the response's `error`
 * string from the failing issues, and this schema runs in front of
 * `validateStableName`, so whatever is written here is what a player reads. Zod's
 * defaults ('Too small: expected string to have >=3 characters') name neither the
 * field nor the rule.
 *
 * Profanity is checked by `validateStableName` in the handler, not here — that is a
 * content rule rather than a shape rule, and it needs the profanity list.
 */
export const stableName = z
  .string()
  .min(3, 'Stable name must be at least 3 characters')
  .max(30, 'Stable name must be 30 characters or less')
  .regex(
    /^[a-zA-Z0-9 _-]+$/,
    'Stable name can only contain letters, numbers, spaces, hyphens, and underscores',
  );
