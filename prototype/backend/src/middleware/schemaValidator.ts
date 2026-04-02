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

import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { securityMonitor } from '../services/security/securityMonitor';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Returns Express middleware that validates request data against the provided Zod schemas.
 * On failure, throws AppError with code VALIDATION_ERROR and a details.fields array.
 */
export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        securityMonitor.logValidationFailure(req.originalUrl, 'invalid_params', req.ip || 'unknown');
        throw new AppError('VALIDATION_ERROR', 'Invalid URL parameters', 400, {
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
        throw new AppError('VALIDATION_ERROR', 'Invalid query parameters', 400, {
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
        throw new AppError('VALIDATION_ERROR', 'Invalid request body', 400, {
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
