import * as fc from 'fast-check';
import { loadEnvConfig } from '../src/config/env';

const NUM_RUNS = 30;

// Save original env so we can restore after each test
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

/**
 * Property 3: CORS origin parsing and enforcement
 *
 * **Validates: Requirements 3.4, 19.1, 19.2**
 *
 * For any comma-separated string of origin URLs in CORS_ORIGIN, the CORS configuration
 * should parse them into an array and accept requests only from those origins when
 * NODE_ENV is not development. In development mode, all origins should be accepted
 * regardless of CORS_ORIGIN value.
 */
describe('CORS Origin Parsing - Property Tests', () => {
  describe('Property 3: CORS origin parsing and enforcement', () => {
    // Generator for realistic origin URLs (scheme + domain)
    const originGen = fc
      .tuple(
        fc.constantFrom('http', 'https'),
        fc.domain()
      )
      .map(([scheme, domain]) => `${scheme}://${domain}`);

    test('in development mode, corsOrigins is always ["*"] regardless of CORS_ORIGIN value', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('https://example.com'),
            fc.constant('https://a.com,https://b.com'),
            fc.string({ minLength: 0, maxLength: 100 })
          ),
          (corsValue) => {
            process.env.NODE_ENV = 'development';
            process.env.CORS_ORIGIN = corsValue;

            const config = loadEnvConfig();

            expect(config.corsOrigins).toEqual(['*']);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('in non-development mode, comma-separated origins are parsed into an array', () => {
      const originsGen = fc.array(originGen, { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.property(
          originsGen,
          fc.constantFrom('acceptance', 'production', 'test'),
          (origins, nodeEnv) => {
            const corsString = origins.join(',');
            process.env.NODE_ENV = nodeEnv;
            process.env.CORS_ORIGIN = corsString;
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            expect(Array.isArray(config.corsOrigins)).toBe(true);
            expect(config.corsOrigins).toEqual(origins);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('origins with whitespace around commas are trimmed', () => {
      const originsGen = fc.array(originGen, { minLength: 1, maxLength: 4 });
      const whitespaceGen = fc.integer({ min: 1, max: 3 }).map(n => ' '.repeat(n));

      fc.assert(
        fc.property(
          originsGen,
          whitespaceGen,
          (origins, ws) => {
            // Add whitespace around each origin
            const corsString = origins.map(o => `${ws}${o}${ws}`).join(',');
            process.env.NODE_ENV = 'acceptance';
            process.env.CORS_ORIGIN = corsString;
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            // Each parsed origin should be trimmed (no leading/trailing whitespace)
            config.corsOrigins.forEach((origin) => {
              expect(origin).toBe(origin.trim());
              expect(origin.length).toBeGreaterThan(0);
            });
            // Should match the original origins (without whitespace)
            expect(config.corsOrigins).toEqual(origins);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('empty segments from consecutive commas are filtered out', () => {
      fc.assert(
        fc.property(
          originGen,
          (origin) => {
            // Create strings with empty segments: ",origin," or ",,origin,,"
            const corsString = `,,${origin},,`;
            process.env.NODE_ENV = 'acceptance';
            process.env.CORS_ORIGIN = corsString;
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            // Empty strings should be filtered out
            expect(config.corsOrigins).toEqual([origin]);
            config.corsOrigins.forEach((o) => {
              expect(o.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('CORS middleware receives true when corsOrigins includes wildcard', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (corsValue) => {
            process.env.NODE_ENV = 'development';
            process.env.CORS_ORIGIN = corsValue;

            const config = loadEnvConfig();

            // In development, corsOrigins is ['*'], so the middleware should get `origin: true`
            const corsOption = config.corsOrigins.includes('*')
              ? true
              : config.corsOrigins;

            expect(corsOption).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('CORS middleware receives origin array when not in development mode', () => {
      const originsGen = fc.array(originGen, { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.property(
          originsGen,
          (origins) => {
            const corsString = origins.join(',');
            process.env.NODE_ENV = 'acceptance';
            process.env.CORS_ORIGIN = corsString;
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            // Non-development origins should not include '*'
            expect(config.corsOrigins.includes('*')).toBe(false);

            // The middleware should receive the array directly
            const corsOption = config.corsOrigins.includes('*')
              ? true
              : config.corsOrigins;

            expect(Array.isArray(corsOption)).toBe(true);
            expect(corsOption).toEqual(origins);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('empty CORS_ORIGIN in non-development mode results in empty array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('acceptance', 'production', 'test'),
          (nodeEnv) => {
            process.env.NODE_ENV = nodeEnv;
            process.env.CORS_ORIGIN = '';
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            expect(config.corsOrigins).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
