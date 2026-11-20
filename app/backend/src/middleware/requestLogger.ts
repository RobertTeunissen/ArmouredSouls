import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { safeRequestPath } from '../utils/safeRequestPath';
import { recordRequest, routePattern } from '../services/monitoring/requestMetrics';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const status = res.statusCode;

    // Only log non-success responses at info level to keep the terminal clean.
    // Successful requests (2xx, 3xx) go to debug so they're still available
    // when LOG_LEVEL=debug but don't flood the console during normal use.
    const level = status >= 400 ? 'warn' : 'debug';

    logger[level]('request completed', {
      method: req.method,
      path: safeRequestPath(req.originalUrl),
      statusCode: status,
      responseTime,
    });
    // Server errors and slow requests feed the admin System page (status only).
    recordRequest({
      method: req.method,
      route: routePattern(req),
      statusCode: status,
      durationMs: responseTime,
      errorCode: typeof res.locals?.errorCode === 'string' ? res.locals.errorCode : null,
    });
  });

  next();
}
