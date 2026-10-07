import * as fc from 'fast-check';
import { loadEnvConfig } from '../src/config/env';

const NUM_RUNS = 10;

// Save original env so we can restore after each test
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.FINANCE_REPORT_REFERENCE_SECRET = 'test-finance-report-reference-secret';
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
 * NODE_ENV is not development. In development mode, a fixed localhost list is used
 * regardless of CORS_ORIGIN value. Outside development, wildcard entries are rejected
 * at startup because the middleware runs with credentials enabled.
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

    test('in development mode, corsOrigins is always localhost origins regardless of CORS_ORIGIN value', () => {
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

            expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000']);
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
            process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

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

    test('development ignores a wildcard CORS_ORIGIN and keeps the localhost list', () => {
      process.env.NODE_ENV = 'development';
      process.env.CORS_ORIGIN = '*';

      const config = loadEnvConfig();

      expect(config.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000']);
    });

    describe('wildcard origins outside development', () => {
      let mockExit: jest.SpiedFunction<typeof process.exit>;
      let mockStderr: jest.SpiedFunction<typeof process.stderr.write>;

      beforeEach(() => {
        mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
          throw new Error(`process.exit(${code})`);
        }) as typeof process.exit);
        mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      });

      afterEach(() => {
        mockExit.mockRestore();
        mockStderr.mockRestore();
      });

      // Credentials are enabled, so a wildcard would allow credentialed requests
      // from any site. Startup must refuse it in every non-development environment.
      test('startup fails when any CORS_ORIGIN entry contains a wildcard', () => {
        fc.assert(
          fc.property(
            fc.array(originGen, { minLength: 0, maxLength: 3 }),
            fc.constantFrom('*', 'https://*.armouredsouls.com', ' * '),
            fc.nat(),
            fc.constantFrom('acceptance', 'production', 'test'),
            (origins, wildcard, position, nodeEnv) => {
              mockExit.mockClear();
              mockStderr.mockClear();
              const entries = [...origins];
              entries.splice(position % (entries.length + 1), 0, wildcard);
              process.env.NODE_ENV = nodeEnv;
              process.env.CORS_ORIGIN = entries.join(',');
              process.env.JWT_SECRET = 'non-default-secret-for-testing';
              process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

              expect(() => loadEnvConfig()).toThrow('process.exit(1)');
              expect(mockExit).toHaveBeenCalledWith(1);
              const output = mockStderr.mock.calls.map(([chunk]) => String(chunk)).join('');
              expect(output).toContain('CORS_ORIGIN');
            }
          ),
          { numRuns: NUM_RUNS }
        );
      });
    });

    test('empty CORS_ORIGIN in non-development mode results in empty array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('acceptance', 'production', 'test'),
          (nodeEnv) => {
            process.env.NODE_ENV = nodeEnv;
            process.env.CORS_ORIGIN = '';
            process.env.JWT_SECRET = 'non-default-secret-for-testing';
            process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

            const config = loadEnvConfig();

            expect(config.corsOrigins).toEqual([]);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
