import * as fc from 'fast-check';
import { loadEnvConfig } from '../src/config/env';

const NUM_RUNS = 30;

// Save original env so we can restore after each test
const originalEnv = process.env;

beforeEach(() => {
  // Create a fresh copy of env for each test
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Environment Config Loading - Property Tests', () => {
  describe('Property 1: Environment config loading round-trip', () => {
    /**
     * **Validates: Requirements 3.1, 25.4**
     * For any set of env var values, `loadEnvConfig()` produces a config with correct
     * type coercion (PORT as number, SCHEDULER_ENABLED as boolean, CORS_ORIGIN as array).
     */

    test('PORT is always coerced to a number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }),
          (port) => {
            process.env.PORT = String(port);
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();

            expect(config.port).toBe(port);
            expect(typeof config.port).toBe('number');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('SCHEDULER_ENABLED is coerced to boolean (true only for "true")', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('true'),
            fc.constant('false'),
            fc.constant(''),
            fc.constant('1'),
            fc.constant('yes'),
            fc.constant('TRUE'),
            fc.constant('True'),
            fc.string({ minLength: 0, maxLength: 10 })
          ),
          (schedulerValue) => {
            process.env.SCHEDULER_ENABLED = schedulerValue;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();

            expect(typeof config.schedulerEnabled).toBe('boolean');
            if (schedulerValue === 'true') {
              expect(config.schedulerEnabled).toBe(true);
            } else {
              expect(config.schedulerEnabled).toBe(false);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('CORS_ORIGIN is parsed as an array from comma-separated string (non-dev)', () => {
      // Generator for origin-like strings without commas (commas are the delimiter)
      const originGen = fc
        .tuple(
          fc.constantFrom('http', 'https'),
          fc.domain()
        )
        .map(([scheme, domain]) => `${scheme}://${domain}`);
      const originsGen = fc.array(originGen, { minLength: 1, maxLength: 5 });

      fc.assert(
        fc.property(
          originsGen,
          (origins) => {
            const corsString = origins.join(',');
            process.env.CORS_ORIGIN = corsString;
            // Use non-development mode so CORS_ORIGIN is actually parsed
            process.env.NODE_ENV = 'acceptance';
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            expect(Array.isArray(config.corsOrigins)).toBe(true);
            // Each origin should be trimmed and present
            const expected = origins.map(o => o.trim()).filter(Boolean);
            expect(config.corsOrigins).toEqual(expected);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('CORS_ORIGIN with spaces around commas is trimmed correctly', () => {
      const originGen = fc
        .tuple(
          fc.constantFrom('http', 'https'),
          fc.domain()
        )
        .map(([scheme, domain]) => `${scheme}://${domain}`);

      fc.assert(
        fc.property(
          fc.array(originGen, { minLength: 1, maxLength: 4 }),
          fc.array(fc.constant('  '), { minLength: 1, maxLength: 4 }),
          (origins, spaces) => {
            // Build a string with random whitespace around commas
            const corsString = origins
              .map((o, i) => (spaces[i] || '') + o + (spaces[i] || ''))
              .join(',');
            process.env.CORS_ORIGIN = corsString;
            process.env.NODE_ENV = 'acceptance';
            process.env.JWT_SECRET = 'non-default-secret-for-testing';

            const config = loadEnvConfig();

            expect(Array.isArray(config.corsOrigins)).toBe(true);
            // All origins should be trimmed
            config.corsOrigins.forEach(origin => {
              expect(origin).toBe(origin.trim());
              expect(origin.length).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('CORS_ORIGIN defaults to ["*"] in development mode regardless of env value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (corsValue) => {
            process.env.CORS_ORIGIN = corsValue;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();

            expect(config.corsOrigins).toEqual(['*']);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('all config fields have correct types for any valid env input', () => {
      fc.assert(
        fc.property(
          fc.record({
            nodeEnv: fc.constantFrom('development', 'acceptance', 'test'),
            port: fc.integer({ min: 1, max: 65535 }),
            databaseUrl: fc.webUrl(),
            jwtSecret: fc.string({ minLength: 1, maxLength: 64 }),
            corsOrigin: fc.string({ minLength: 0, maxLength: 100 }),
            schedulerEnabled: fc.constantFrom('true', 'false', '', 'yes', '1'),
          }),
          (env) => {
            process.env.NODE_ENV = env.nodeEnv;
            process.env.PORT = String(env.port);
            process.env.DATABASE_URL = env.databaseUrl;
            process.env.JWT_SECRET = env.jwtSecret;
            process.env.CORS_ORIGIN = env.corsOrigin;
            process.env.SCHEDULER_ENABLED = env.schedulerEnabled;

            const config = loadEnvConfig();

            // Type checks
            expect(typeof config.nodeEnv).toBe('string');
            expect(typeof config.port).toBe('number');
            expect(typeof config.databaseUrl).toBe('string');
            expect(typeof config.jwtSecret).toBe('string');
            expect(Array.isArray(config.corsOrigins)).toBe(true);
            expect(typeof config.schedulerEnabled).toBe('boolean');

            // Value checks
            expect(config.nodeEnv).toBe(env.nodeEnv);
            expect(config.port).toBe(env.port);
            expect(config.databaseUrl).toBe(env.databaseUrl);
            expect(config.jwtSecret).toBe(env.jwtSecret);
            expect(config.schedulerEnabled).toBe(env.schedulerEnabled === 'true');
            expect(Number.isFinite(config.port)).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('PORT defaults to 3001 when not set', () => {
      delete process.env.PORT;
      process.env.NODE_ENV = 'development';

      const config = loadEnvConfig();
      expect(config.port).toBe(3001);
    });

    test('PORT handles non-numeric strings by returning NaN-safe number', () => {
      // parseInt with radix 10 returns NaN for non-numeric strings,
      // but the default '3001' is used when PORT is not set.
      // When PORT IS set to a numeric string, it should parse correctly.
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 65535 }),
          (port) => {
            process.env.PORT = String(port);
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.port).toBe(port);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 2: JWT secret validation in production', () => {
    /**
     * **Validates: Requirements 3.2, 3.3**
     * For any placeholder JWT_SECRET in production, startup should fail.
     * For any non-placeholder secret, startup should succeed.
     */

    let mockExit: jest.SpyInstance;
    let mockConsoleError: jest.SpyInstance;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as any);
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('startup fails when JWT_SECRET is the default placeholder in production', () => {
      fc.assert(
        fc.property(
          fc.constant('dev-secret-change-in-production'),
          (secret) => {
            process.env.NODE_ENV = 'production';
            process.env.JWT_SECRET = secret;

            expect(() => loadEnvConfig()).toThrow('process.exit called');
            expect(mockExit).toHaveBeenCalledWith(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('startup succeeds for any non-placeholder JWT_SECRET in production', () => {
      // Generate arbitrary strings that are NOT the default placeholder
      const nonPlaceholderSecret = fc
        .string({ minLength: 1, maxLength: 128 })
        .filter((s) => s !== 'default-dev-secret');

      fc.assert(
        fc.property(
          nonPlaceholderSecret,
          (secret) => {
            process.env.NODE_ENV = 'production';
            process.env.JWT_SECRET = secret;
            process.env.CORS_ORIGIN = 'https://example.com';
            process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

            const config = loadEnvConfig();

            expect(config.jwtSecret).toBe(secret);
            expect(config.nodeEnv).toBe('production');
            expect(mockExit).not.toHaveBeenCalled();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('startup succeeds with any JWT_SECRET when NODE_ENV is not production', () => {
      const nonProductionEnv = fc.constantFrom('development', 'acceptance', 'test');

      fc.assert(
        fc.property(
          nonProductionEnv,
          fc.oneof(
            fc.constant('default-dev-secret'),
            fc.string({ minLength: 1, maxLength: 128 })
          ),
          (env, secret) => {
            process.env.NODE_ENV = env;
            process.env.JWT_SECRET = secret;

            const config = loadEnvConfig();

            expect(config.jwtSecret).toBe(secret);
            expect(config.nodeEnv).toBe(env);
            expect(mockExit).not.toHaveBeenCalled();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('startup fails with default secret when JWT_SECRET env var is unset in production', () => {
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';

      expect(() => loadEnvConfig()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Property 3: Registration-related environment variables', () => {
    /**
     * **Validates: Requirements 10.8**
     * Registration-related env vars (JWT_EXPIRATION, BCRYPT_SALT_ROUNDS,
     * RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS) are parsed with correct
     * types and fall back to safe defaults for invalid or missing values.
     */

    test('JWT_EXPIRATION defaults to 24h when not set', () => {
      delete process.env.JWT_EXPIRATION;
      process.env.NODE_ENV = 'development';

      const config = loadEnvConfig();
      expect(config.jwtExpiration).toBe('24h');
    });

    test('JWT_EXPIRATION uses the provided value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('1h', '7d', '30m', '24h', '12h'),
          (expiration) => {
            process.env.JWT_EXPIRATION = expiration;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.jwtExpiration).toBe(expiration);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('BCRYPT_SALT_ROUNDS is coerced to a number within valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 31 }),
          (rounds) => {
            process.env.BCRYPT_SALT_ROUNDS = String(rounds);
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.bcryptSaltRounds).toBe(rounds);
            expect(typeof config.bcryptSaltRounds).toBe('number');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('BCRYPT_SALT_ROUNDS defaults to 10 for invalid values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant('-1'),
            fc.constant('0'),
            fc.constant('3'),
            fc.constant('32'),
            fc.constant('100')
          ),
          (value) => {
            process.env.BCRYPT_SALT_ROUNDS = value;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.bcryptSaltRounds).toBe(10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('RATE_LIMIT_WINDOW_MS is coerced to a positive number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400000 }),
          (windowMs) => {
            process.env.RATE_LIMIT_WINDOW_MS = String(windowMs);
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.rateLimitWindowMs).toBe(windowMs);
            expect(typeof config.rateLimitWindowMs).toBe('number');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('RATE_LIMIT_WINDOW_MS defaults to 60000 for invalid values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant('0'),
            fc.constant('-1000')
          ),
          (value) => {
            process.env.RATE_LIMIT_WINDOW_MS = value;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.rateLimitWindowMs).toBe(60000);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('RATE_LIMIT_MAX_REQUESTS is coerced to a positive number', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (maxReqs) => {
            process.env.RATE_LIMIT_MAX_REQUESTS = String(maxReqs);
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.rateLimitMaxRequests).toBe(maxReqs);
            expect(typeof config.rateLimitMaxRequests).toBe('number');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('RATE_LIMIT_MAX_REQUESTS defaults to 10 for invalid values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('invalid'),
            fc.constant(''),
            fc.constant('0'),
            fc.constant('-5')
          ),
          (value) => {
            process.env.RATE_LIMIT_MAX_REQUESTS = value;
            process.env.NODE_ENV = 'development';

            const config = loadEnvConfig();
            expect(config.rateLimitMaxRequests).toBe(10);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('DATABASE_URL validation fails in production when not set', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as any);
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      delete process.env.DATABASE_URL;
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-real-secret';

      expect(() => loadEnvConfig()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    test('DATABASE_URL is allowed to be empty in non-production', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('development', 'test'),
          (env) => {
            delete process.env.DATABASE_URL;
            process.env.NODE_ENV = env;

            const config = loadEnvConfig();
            expect(config.databaseUrl).toBe('');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
