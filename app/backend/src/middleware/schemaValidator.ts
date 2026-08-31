/**
 * @module middleware/schemaValidator
 *
 * Generic Express middleware factory that validates req.body, req.params,
 * and req.query against per-route Zod schemas.
 *
 * Validation order: params → query → body (cheapest checks first).
 * Body parsing uses Zod's default .strip() to remove unknown fields,
 * preventing mass-assignment attacks (Req 1.6).
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 5.6
 */

import { ZodSchema, type ZodIssue } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { securityMonitor } from '../services/security/securityMonitor';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Build the human-readable `error` string from Zod issues.
 *
 * Spec #51: this used to be a fixed string — 'Invalid request body' and friends —
 * with the useful text buried in `details.fields`. That broke a client contract.
 * `RegistrationForm.tsx` maps a VALIDATION_ERROR to the offending input by
 * keyword-matching the message ("username", "email", "password", "stable"), so a
 * message of 'Invalid request body' matched nothing and every server-side
 * validation failure landed in the generic banner instead of under its field.
 *
 * Its own comment recorded the contract it depended on: "The backend joins
 * multiple errors with ', '". That was true of `validateRegistrationRequest`,
 * which this middleware was placed in front of.
 *
 * `details.fields` is unchanged, so structured consumers are unaffected.
 *
 * CONVENTION for schema authors: write messages that name their own field, e.g.
 * 'Username must be at least 3 characters long' rather than Zod's default
 * 'Too small: ...'. The message is what reaches the user.
 *
 * Note on safety: `issue.message` and `issue.path` come from the schema, never
 * from the submitted value, so this reflects no user input back to the client.
 */
function describeIssues(issues: ZodIssue[], fallback: string, input: unknown): string {
  const messages = issues.map((issue) => describeIssue(issue, input)).filter(Boolean);
  return messages.length > 0 ? messages.join(', ') : fallback;
}

/**
 * Read the submitted value at an issue's path, to tell a MISSING key from a wrong-typed one.
 *
 * Returns `undefined` both for an absent key and for a path that cannot be walked, which is
 * the same answer for this decision either way.
 */
function valueAtPath(input: unknown, path: ZodIssue['path']): unknown {
  let current: unknown = input;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key as string | number];
  }
  return current;
}

/**
 * Render one issue as user-facing text.
 *
 * A missing key is special-cased. Zod reports it as
 * 'Invalid input: expected string, received undefined', which names neither the
 * field nor the problem, so an absent `password` and an absent `stableName` were
 * indistinguishable to the user. This turns it into '<Field> is required'.
 *
 * Missing-ness is decided from the SUBMITTED VALUE at `issue.path`, not by matching
 * `issue.message`. The message text varies across Zod versions and error maps, so a regex
 * over it is brittle — and the obvious structured alternative is not available: Zod 4 removed
 * `received` from `invalid_type` issues, which carry only `expected`, `code`, `path` and
 * `message` (verified against zod 4.4.3). The value at the path is version-independent: for an
 * absent key it is `undefined`, and for a wrong-typed key it is the offending value.
 *
 * Note on safety: only the PRESENCE of that value is used. It is never interpolated into the
 * message, so this still reflects no user input back to the client — `issue.message` and
 * `issue.path` continue to come from the schema alone.
 */
function describeIssue(issue: ZodIssue, input: unknown): string {
  const isMissing =
    issue.code === 'invalid_type' && valueAtPath(input, issue.path) === undefined;
  if (isMissing) {
    const field = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : 'Value';
    return `${field.charAt(0).toUpperCase()}${field.slice(1)} is required`;
  }
  return issue.message;
}

/**
 * Returns Express middleware that validates request data against the provided Zod schemas.
 * On failure, throws AppError with code VALIDATION_ERROR, a human-readable message
 * built from the failing issues, and a details.fields array.
 */
export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        securityMonitor.logValidationFailure(req.originalUrl, 'invalid_params', req.ip || 'unknown');
        throw new AppError('VALIDATION_ERROR', describeIssues(result.error.issues, 'Invalid URL parameters', req.params), 400, {
          fields: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      req.params = result.data as typeof req.params;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        securityMonitor.logValidationFailure(req.originalUrl, 'invalid_query', req.ip || 'unknown');
        throw new AppError('VALIDATION_ERROR', describeIssues(result.error.issues, 'Invalid query parameters', req.query), 400, {
          fields: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        securityMonitor.logValidationFailure(req.originalUrl, 'invalid_body', req.ip || 'unknown');
        throw new AppError('VALIDATION_ERROR', describeIssues(result.error.issues, 'Invalid request body', req.body), 400, {
          fields: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      req.body = result.data; // Strips unknown fields (Req 1.6)
    }

    next();
  };
}
