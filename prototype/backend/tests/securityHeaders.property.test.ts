/**
 * Feature: security-audit-guardrails, Property 13: Security headers present on all responses
 *
 * **Validates: Requirements 5.5, 10.3, 10.5**
 *
 * For any HTTP response from the application, the response headers shall include
 * Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options,
 * Referrer-Policy, and Strict-Transport-Security with max-age >= 31536000
 * and includeSubDomains.
 */
import * as fc from 'fast-check';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

const NUM_RUNS = 50;

/**
 * Build a minimal Express app with the same Helmet config as production (src/index.ts).
 * Registers a dynamic route so we can test arbitrary paths.
 */
function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Catch-all route that returns 200 for any path (Express 5 syntax)
  app.all('{*path}', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('Feature: security-audit-guardrails, Property 13: Security headers present on all responses', () => {
  const app = createApp();

  // Generator for safe URL path segments (alphanumeric + hyphens)
  const pathSegmentGen = fc.string({ minLength: 1, maxLength: 12, unit: fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')
  ) });

  // Generator for URL paths like /api/foo/bar
  const pathGen = fc.array(pathSegmentGen, { minLength: 1, maxLength: 4 })
    .map(segments => '/' + segments.join('/'));

  // Helper to make a request with a dynamic method
  async function makeRequest(method: string, path: string) {
    const agent = request(app);
    switch (method) {
      case 'post': return agent.post(path);
      case 'put': return agent.put(path);
      case 'delete': return agent.delete(path);
      case 'patch': return agent.patch(path);
      default: return agent.get(path);
    }
  }

  // Generator for HTTP methods
  const methodGen = fc.constantFrom('get', 'post', 'put', 'delete', 'patch');

  it('every response includes Content-Security-Policy header', () => {
    return fc.assert(
      fc.asyncProperty(pathGen, methodGen, async (path, method) => {
        const res = await makeRequest(method, path);
        expect(res.headers['content-security-policy']).toBeDefined();
        expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('every response includes X-Content-Type-Options: nosniff', () => {
    return fc.assert(
      fc.asyncProperty(pathGen, methodGen, async (path, method) => {
        const res = await makeRequest(method, path);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('every response includes X-Frame-Options header', () => {
    return fc.assert(
      fc.asyncProperty(pathGen, methodGen, async (path, method) => {
        const res = await makeRequest(method, path);
        expect(res.headers['x-frame-options']).toBeDefined();
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('every response includes Referrer-Policy header', () => {
    return fc.assert(
      fc.asyncProperty(pathGen, methodGen, async (path, method) => {
        const res = await makeRequest(method, path);
        expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it('every response includes Strict-Transport-Security with max-age >= 31536000 and includeSubDomains', () => {
    return fc.assert(
      fc.asyncProperty(pathGen, methodGen, async (path, method) => {
        const res = await makeRequest(method, path);
        const hsts = res.headers['strict-transport-security'];
        expect(hsts).toBeDefined();

        // Parse max-age value
        const maxAgeMatch = hsts.match(/max-age=(\d+)/);
        expect(maxAgeMatch).not.toBeNull();
        expect(parseInt(maxAgeMatch![1], 10)).toBeGreaterThanOrEqual(31536000);

        // Must include includeSubDomains directive
        expect(hsts.toLowerCase()).toContain('includesubdomains');
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
