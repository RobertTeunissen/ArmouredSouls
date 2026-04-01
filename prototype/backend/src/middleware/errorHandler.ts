import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import logger from '../config/logger';

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

/**
 * Express error-handling middleware that produces consistent JSON error responses.
 *
 * Handles three categories of errors:
 * 1. AppError instances (and subclasses) - returns structured { error, code, details? }
 * 2. Prisma PrismaClientKnownRequestError - maps to appropriate HTTP status and code
 * 3. Unknown errors - returns 500 with INTERNAL_ERROR, hides stack in production
 *
 * All errors are logged with request context (method, path) for debugging.
 *
 * @param err - The error that was thrown or rejected
 * @param req - Express request object
 * @param res - Express response object
 * @param _next - Express next function (unused but required for Express error middleware signature)
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Structured app errors (AppError and all subclasses)
  if (err instanceof AppError) {
    logger.warn('App error', { code: err.code, status: err.statusCode, method: req.method, path: req.originalUrl });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Prisma known errors - detect by constructor name to avoid importing Prisma client
  if (err.constructor?.name === 'PrismaClientKnownRequestError' && 'code' in err) {
    const prismaCode = (err as any).code as string;
    const mapping = PRISMA_ERROR_MAP[prismaCode];
    if (mapping) {
      logger.warn('Prisma error', { prismaCode, mapped: mapping.code, method: req.method, path: req.originalUrl });
      res.status(mapping.statusCode).json({ error: err.message, code: mapping.code });
      return;
    }
  }

  // Unknown errors - return 500 and hide internals in production
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'acceptance';
  logger.error('Unhandled error', { message: err.message, stack: err.stack, method: req.method, path: req.originalUrl });
  res.status(500).json({
    error: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { message: err.message, stack: err.stack }),
  });
}
