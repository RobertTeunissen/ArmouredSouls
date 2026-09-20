import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';
import { getConfig } from '../config/env';
import { securityMonitor } from '../services/security/securityMonitor';
import { safeRequestPath } from '../utils/safeRequestPath';
import type { AuthRequest } from './auth';

/**
 * Mapping of Prisma error codes to HTTP status codes and machine-readable error codes.
 *
 * P2002: Unique constraint violation (e.g., duplicate email)
 * P2025: Record not found (e.g., update/delete on non-existent record)
 * P2003: Foreign key constraint violation
 * P2014: Relation violation (required relation would be violated)
 */
const PRISMA_ERROR_MAP: Record<string, { statusCode: number; code: string }> = {
  P2002: { statusCode: 409, code: 'DATABASE_UNIQUE_VIOLATION' },
  P2025: { statusCode: 404, code: 'DATABASE_RECORD_NOT_FOUND' },
  P2003: { statusCode: 400, code: 'DATABASE_FOREIGN_KEY_VIOLATION' },
  P2014: { statusCode: 400, code: 'DATABASE_RELATION_VIOLATION' },
};

function redactSearchText(text: string, req: Request): string {
  if (safeRequestPath(req.originalUrl) !== '/api/search') return text;

  const query = req.query as Record<string, unknown>;
  const rawQuery = typeof query.q === 'string' ? query.q : undefined;
  const normalizedQuery = rawQuery?.trim();
  const candidates = [rawQuery, normalizedQuery].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  return candidates.reduce((redacted, candidate) => {
    let result = '';
    let cursor = 0;
    const lowerText = redacted.toLocaleLowerCase();
    const lowerCandidate = candidate.toLocaleLowerCase();

    while (cursor < redacted.length) {
      const matchStart = lowerText.indexOf(lowerCandidate, cursor);
      if (matchStart === -1) {
        result += redacted.slice(cursor);
        break;
      }
      result += redacted.slice(cursor, matchStart) + '[REDACTED]';
      cursor = matchStart + candidate.length;
    }

    return result;
  }, text);
}

function redactSearchDetails(details: unknown, req: Request): unknown {
  if (typeof details === 'string') return redactSearchText(details, req);
  if (Array.isArray(details)) return details.map((value) => redactSearchDetails(value, req));
  if (details && typeof details === 'object') {
    return Object.fromEntries(
      Object.entries(details).map(([key, value]) => [key, redactSearchDetails(value, req)]),
    );
  }
  return details;
}

/**
 * Express error-handling middleware that produces consistent JSON error responses.
 *
 * Handles three categories of errors:
 * 1. AppError instances (and subclasses) - returns structured { error, code, details? }
 * 2. Prisma PrismaClientKnownRequestError - maps to appropriate HTTP status and code
 * 3. Unknown errors - returns 500 with INTERNAL_ERROR, hides stack in production
 *
 * All errors are logged with request context (method, path) for debugging.
 * Search endpoint diagnostics use a query-free path and never record query text.
 *
 * @param err - The error that was thrown or rejected
 * @param req - Express request object
 * @param res - Express response object
 * @param _next - Express next function (unused but required for Express error middleware signature)
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const path = safeRequestPath(req.originalUrl);
  const isSearchRequest = path === '/api/search';

  // Structured app errors (AppError and all subclasses)
  if (err instanceof AppError) {
    logger.warn('App error', { code: err.code, status: err.statusCode, method: req.method, path });
    res.status(err.statusCode).json({
      error: redactSearchText(err.message, req),
      code: err.code,
      ...(err.details !== undefined ? { details: redactSearchDetails(err.details, req) } : {}),
    });
    return;
  }

  // Prisma known errors - detect by constructor name to avoid importing Prisma client
  if (err.constructor?.name === 'PrismaClientKnownRequestError' && 'code' in err) {
    const prismaCode = (err as Record<string, unknown>).code as string;
    const mapping = PRISMA_ERROR_MAP[prismaCode];
    if (mapping) {
      // Prisma messages can contain submitted values. Keep the existing diagnostic
      // detail for unrelated routes, but never retain it for the search endpoint.
      logger.warn('Prisma error', {
        prismaCode,
        mapped: mapping.code,
        prismaMessage: isSearchRequest ? '[REDACTED]' : err.message,
        method: req.method,
        path,
      });

      // Track 409 conflicts for race-condition exploit detection (Req 7.2)
      if (mapping.statusCode === 409) {
        const authReq = req as AuthRequest;
        if (authReq.user?.userId) {
          securityMonitor.trackConflict(authReq.user.userId, {
            sourceIp: req.ip || undefined,
            endpoint: path,
          });
        }
      }

      res.status(mapping.statusCode).json({ error: mapping.code.replace(/_/g, ' ').toLowerCase(), code: mapping.code });
      return;
    }
  }

  // Unknown errors - return 500 and hide internals in all environments.
  // Never reflect raw error messages — they may contain unsanitized user input (XSS vector).
  const { nodeEnv } = getConfig();
  const isProduction = nodeEnv === 'production' || nodeEnv === 'acceptance';
  logger.error('Unhandled error', {
    message: isSearchRequest ? '[REDACTED]' : err.message,
    stack: isSearchRequest ? '[REDACTED]' : err.stack,
    method: req.method,
    path,
  });
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { message: 'An unexpected error occurred. Check server logs for details.' }),
  });
}
