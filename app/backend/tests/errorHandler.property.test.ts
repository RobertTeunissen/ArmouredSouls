/**
 * Feature: security-audit-guardrails, Property 12: Error message sanitization
 *
 * **Validates: Requirements 5.4**
 *
 * For any error thrown during request processing where the error message contains
 * user-supplied input (e.g., a robot name with HTML/script tags), the HTTP response
 * body shall not contain the raw unsanitized input. The error handler shall return
 * a generic message for unknown errors.
 */
import * as fc from 'fast-check';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock the security logger to prevent file I/O during tests
jest.mock('../src/services/security/securityLogger', () => ({
  SecuritySeverity: {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
  },
  securityLogger: {
    log: jest.fn(),
  },
}));

// Mock prisma (transitive dependency via securityMonitor)
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

// Suppress Winston error logging during tests
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { errorHandler } from '../src/middleware/errorHandler';
import { AppError } from '../src/errors/AppError';

const NUM_RUNS = 100;

/**
 * Build a minimal Express app with the production error handler.
 * Accepts a route that throws an error with the provided message.
 */
function createApp() {
  const app = express();
  app.use(express.json());

  // Route that throws an unknown Error with the message from query param
  app.get('/throw-unknown', (req: Request, _res: Response, _next: NextFunction) => {
    throw new Error(req.query.msg as string);
  });

  // Route that throws an AppError with the message from query param
  app.get('/throw-app-error', (req: Request, _res: Response, _next: NextFunction) => {
    throw new AppError('TEST_ERROR', req.query.msg as string, 400);
  });

  app.use(errorHandler);
  return app;
}

/** Generator for strings containing HTML/script injection patterns */
const htmlInjectionGen = fc.oneof(
  // Script tags
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `<script>${s}</script>`),
  // HTML tags
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `<img src=x onerror="${s}">`),
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `<div onmouseover="${s}">`),
  // Event handlers
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `<a href="javascript:${s}">`),
  // Mixed content with HTML entities
  fc.string({ minLength: 1, maxLength: 30 }).map(s => `${s}<script>alert(1)</script>${s}`),
  // SVG-based XSS
  fc.string({ minLength: 1, maxLength: 20 }).map(s => `<svg onload="${s}">`),
  // Iframe injection
  fc.constant('<iframe src="https://evil.com"></iframe>'),
  // Style-based injection
  fc.constant('<style>body{background:url("javascript:alert(1)")}</style>'),
);

describe('Feature: security-audit-guardrails, Property 12: Error message sanitization', () => {
  const app = createApp();

  it('unknown errors never reflect HTML/script content in the response body', () => {
    return fc.assert(
      fc.asyncProperty(htmlInjectionGen, async (maliciousMsg) => {
        const res = await request(app)
          .get('/throw-unknown')
          .query({ msg: maliciousMsg });

        expect(res.status).toBe(500);

        const body = JSON.stringify(res.body);

        // The response must not contain the raw malicious input
        expect(body).not.toContain(maliciousMsg);

        // The response must use the generic error message
        expect(res.body.error).toBe('Internal Server Error');
        expect(res.body.code).toBe('INTERNAL_ERROR');
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('unknown errors never contain <script> tags in any response field', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `<script>${s}</script>`),
        async (scriptTag) => {
          const res = await request(app)
            .get('/throw-unknown')
            .query({ msg: scriptTag });

          expect(res.status).toBe(500);

          const body = JSON.stringify(res.body);
          expect(body).not.toContain('<script>');
          expect(body).not.toContain('</script>');
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  it('AppError messages are returned as-is (developer-controlled, not user input)', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes('"') && !s.includes('\\')),
        async (msg) => {
          const res = await request(app)
            .get('/throw-app-error')
            .query({ msg });

          expect(res.status).toBe(400);
          expect(res.body.code).toBe('TEST_ERROR');
          // AppError messages are developer-controlled and returned directly
          expect(res.body.error).toBe(msg);
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });
});
