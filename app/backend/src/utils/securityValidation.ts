/**
 * @module utils/securityValidation
 *
 * Centralized Zod validation primitives for security-critical input fields.
 * Route schemas import these instead of defining inline regex checks.
 *
 * @see Requirements 1.4, 5.1, 5.2, 5.3, 5.6, 9.2
 */

import { z } from 'zod';
import { SAFE_NAME_MAX_LENGTH, SAFE_NAME_PATTERN, stableNameErrors } from '../shared/utils/accountRules';

/**
 * A string checked by one of the shared account rules (`shared/utils/accountRules`):
 * each failed rule becomes an issue with the rule's own user-facing message.
 */
export function ruleCheckedString(rules: (value: string) => string[]): z.ZodString {
  return z.string().superRefine((value, ctx) => {
    for (const message of rules(value)) ctx.addIssue({ code: 'custom', message });
  });
}

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
  .max(SAFE_NAME_MAX_LENGTH, `Name must be ${SAFE_NAME_MAX_LENGTH} characters or less`)
  .regex(
    SAFE_NAME_PATTERN,
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

/**
 * A league instance id: tier name and instance number joined by underscores
 * (`bronze_1`, `champion_12`). Lowercase letters, digits and `_` only, at most
 * the 30 characters of `standings.league_instance_id`.
 */
export const leagueInstanceId = z
  .string()
  .max(30, 'Instance must be at most 30 characters')
  .regex(/^[a-z]+_[a-z0-9_]*[a-z0-9]$/, 'Instance must be a league instance id such as bronze_1');

/** Positive integer ID (coerced from string or number input). */
/** A calendar date `YYYY-MM-DD` (UTC day), e.g. an activation day filter. */
export const calendarDate = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Must be a date (YYYY-MM-DD)');

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
 * A robot appearance image path: a bundled preset (`/assets/robots…`,
 * `/src/assets/robot…`) or the player's own upload
 * (`/uploads/user-robots/<userId>/<uuid>.webp`). WebP only; no other
 * directories, no `..`, no query string.
 */
export const robotImagePath = z
  .string()
  .min(1, 'Invalid imageUrl')
  .max(200, 'Invalid imageUrl')
  .regex(
    /^\/(?:(?:src\/)?assets\/robots?[\w/-]*|uploads\/user-robots\/\d+\/[0-9a-f-]+)\.webp$/,
    'Invalid image path. Must be a .webp file from presets or uploads.',
  );

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
 * Stable name: letters, numbers, spaces, hyphens, underscores (3–30 characters).
 * The rule and its user-facing wording live in `shared/utils/accountRules`
 * (the registration and profile forms use them too). Profanity is checked by
 * `validateStableName` in the handler: a content rule, not a shape rule.
 */
export const stableName = ruleCheckedString(stableNameErrors);
