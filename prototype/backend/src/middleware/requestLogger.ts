import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /jwt/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /connection.*string/i,
  /database.*url/i,
  /postgresql:\/\//i,
];

export function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_PATTERNS.some((p) => p.test(key))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && SENSITIVE_PATTERNS.some((p) => p.test(value))) {
      redacted[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;

    logger.info('request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
    });
  });

  next();
}
