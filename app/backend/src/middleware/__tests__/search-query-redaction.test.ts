const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const mockSecurityMonitor = {
  logValidationFailure: jest.fn(),
  trackRateLimitViolation: jest.fn(),
  trackConflict: jest.fn(),
};

let mockNodeEnv = 'test';

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: (...args: unknown[]) => mockLogger.warn(...args),
    error: (...args: unknown[]) => mockLogger.error(...args),
    info: (...args: unknown[]) => mockLogger.info(...args),
    debug: (...args: unknown[]) => mockLogger.debug(...args),
  },
}));

jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: (...args: unknown[]) => mockSecurityMonitor.logValidationFailure(...args),
    trackRateLimitViolation: (...args: unknown[]) => mockSecurityMonitor.trackRateLimitViolation(...args),
    trackConflict: (...args: unknown[]) => mockSecurityMonitor.trackConflict(...args),
  },
}));

jest.mock('../../config/env', () => ({
  getConfig: () => ({ nodeEnv: mockNodeEnv }),
}));

import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import type { AuthRequest } from '../auth';
import { errorHandler } from '../errorHandler';
import { requestLogger } from '../requestLogger';
import { validateRequest } from '../schemaValidator';
import { createUserEconomicLimiter } from '../userRateLimiter';
import { AppError } from '../../errors/AppError';
import { safeRequestPath } from '../../utils/safeRequestPath';

type MockResponse = Response & {
  statusCode: number;
  status: jest.Mock;
  json: jest.Mock;
  on: jest.Mock;
};

function createResponse(statusCode = 200): MockResponse {
  const response = {
    statusCode,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    on: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response as MockResponse;
}

function createRequest(originalUrl: string, query: Record<string, unknown> = {}): Request {
  return {
    method: 'GET',
    originalUrl,
    query,
    ip: '127.0.0.1',
  } as unknown as Request;
}

describe('search query redaction in diagnostics and errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNodeEnv = 'test';
  });

  it('removes the search query while preserving unrelated request URLs', () => {
    expect(safeRequestPath('/api/search?q=secret%20phrase')).toBe('/api/search');
    expect(safeRequestPath('/api/search?q=secret%20phrase&owner=7')).toBe('/api/search');
    expect(safeRequestPath('/api/robots/7?name=secret')).toBe('/api/robots/7?name=secret');
  });

  it('logs a query-free path for completed search requests', () => {
    const requestContext = createRequest('/api/search?q=secret%20phrase');
    const response = createResponse();
    const next = jest.fn() as NextFunction;
    response.on.mockImplementation((_event: string, listener: () => void) => listener());

    requestLogger(requestContext, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith('request completed', expect.objectContaining({
      path: '/api/search',
    }));
    expect(JSON.stringify(mockLogger.debug.mock.calls)).not.toContain('secret phrase');
  });

  it('logs validation failures with a query-free path and no query text', () => {
    const middleware = validateRequest({
      query: z.object({ q: z.string().max(3, 'q must be at most 3 characters') }).strict(),
    });
    const requestContext = createRequest('/api/search?q=secret%20phrase', { q: 'secret phrase' });

    expect(() => middleware(requestContext, {} as Response, jest.fn())).toThrow(AppError);

    expect(mockSecurityMonitor.logValidationFailure).toHaveBeenCalledWith(
      '/api/search',
      'invalid_query',
      '127.0.0.1',
    );
    expect(JSON.stringify(mockSecurityMonitor.logValidationFailure.mock.calls)).not.toContain('secret phrase');
  });

  it('uses a query-free path for rate-limit diagnostics', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as AuthRequest).user = { userId: 42, username: 'player', role: 'user' };
      next();
    });
    app.use(createUserEconomicLimiter({ userEconomicRateLimitMax: 1 }));
    app.get('/api/search', (_req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).get('/api/search').query({ q: 'secret phrase' });
    const limited = await request(app).get('/api/search').query({ q: 'secret phrase' });

    expect(first.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
    expect(mockSecurityMonitor.trackRateLimitViolation).toHaveBeenCalledWith(42, '/api/search');
    expect(JSON.stringify(mockSecurityMonitor.trackRateLimitViolation.mock.calls)).not.toContain('secret phrase');
    expect(JSON.stringify(limited.body)).not.toContain('secret phrase');
  });

  it('keeps raw search phrases out of dependency error logs and responses', () => {
    const phrase = 'secret phrase';
    const requestContext = createRequest('/api/search?q=secret%20phrase', { q: phrase });
    const response = createResponse();

    errorHandler(new Error(`search dependency failed for ${phrase}`), requestContext, response, jest.fn());

    expect(mockLogger.error).toHaveBeenCalledWith('Unhandled error', expect.objectContaining({
      path: '/api/search',
      message: '[REDACTED]',
      stack: '[REDACTED]',
    }));
    expect(JSON.stringify(mockLogger.error.mock.calls)).not.toContain(phrase);
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(phrase);
  });

  it('redacts raw and normalized phrases from search AppError responses', () => {
    const phrase = 'Secret Phrase';
    const requestContext = createRequest('/api/search?q=%20Secret%20Phrase%20', { q: ` ${phrase} ` });
    const response = createResponse();

    errorHandler(
      new AppError('SEARCH_ERROR', `Could not search for ${phrase}`, 400, { query: phrase }),
      requestContext,
      response,
      jest.fn(),
    );

    const body = response.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.error).toBe('Could not search for [REDACTED]');
    expect(body.details).toEqual({ query: '[REDACTED]' });
    expect(JSON.stringify(body)).not.toContain(phrase);
  });

  it('redacts Prisma error text from search diagnostics while preserving mapped responses', () => {
    const phrase = 'secret phrase';
    const prismaError = new Error(`Unique value contains ${phrase}`);
    Object.defineProperty(prismaError, 'constructor', {
      value: { name: 'PrismaClientKnownRequestError' },
    });
    (prismaError as Error & { code: string }).code = 'P2002';
    const requestContext = createRequest('/api/search?q=secret%20phrase', { q: phrase });
    const response = createResponse();

    errorHandler(prismaError, requestContext, response, jest.fn());

    expect(mockLogger.warn).toHaveBeenCalledWith('Prisma error', expect.objectContaining({
      path: '/api/search',
      prismaMessage: '[REDACTED]',
    }));
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain(phrase);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: 'database unique violation',
      code: 'DATABASE_UNIQUE_VIOLATION',
    });
  });
});
