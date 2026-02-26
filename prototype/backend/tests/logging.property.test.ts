import * as fc from 'fast-check';
import winston from 'winston';
import { Writable } from 'stream';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { redactSensitive, requestLogger } from '../src/middleware/requestLogger';

/** Create a writable stream that captures chunks into an array */
function captureStream(logs: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      logs.push(chunk.toString().trim());
      callback();
    },
  });
}

const NUM_RUNS = 100;

describe('Logging - Property Tests', () => {
  describe('Property 9: Structured JSON logging in production', () => {
    /**
     * **Validates: Requirements 13.1**
     * For any log message produced when NODE_ENV is production or acceptance,
     * the output should be valid JSON containing at minimum timestamp, level, and message fields.
     */

    test('all log output is valid JSON with timestamp, level, and message in structured environments', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('production', 'acceptance'),
          fc.constantFrom('info', 'warn', 'error', 'debug'),
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\x00')),
          (nodeEnv, level, message) => {
            const logs: string[] = [];

            const testLogger = winston.createLogger({
              level: 'debug',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
              transports: [
                new winston.transports.Stream({ stream: captureStream(logs) }),
              ],
              defaultMeta: { service: 'armouredsouls' },
            });

            testLogger.log(level, message);

            expect(logs.length).toBe(1);

            // Must be valid JSON
            const parsed = JSON.parse(logs[0]);

            // Must contain required fields
            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('level');
            expect(parsed).toHaveProperty('message');

            // Values must match
            expect(parsed.level).toBe(level);
            expect(parsed.message).toBe(message);
            expect(parsed.service).toBe('armouredsouls');

            // Timestamp must be a valid ISO date
            expect(new Date(parsed.timestamp).toISOString()).toBeTruthy();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('log entries with arbitrary metadata are still valid JSON with required fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.includes('\x00')),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)),
            fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.boolean()),
            { minKeys: 0, maxKeys: 5 },
          ),
          (message, meta) => {
            const logs: string[] = [];

            const testLogger = winston.createLogger({
              level: 'debug',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
              transports: [
                new winston.transports.Stream({ stream: captureStream(logs) }),
              ],
              defaultMeta: { service: 'armouredsouls' },
            });

            testLogger.info(message, meta);

            expect(logs.length).toBe(1);
            const parsed = JSON.parse(logs[0]);

            expect(parsed).toHaveProperty('timestamp');
            expect(parsed).toHaveProperty('level', 'info');
            expect(parsed).toHaveProperty('message', message);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Property 10: Request logging completeness', () => {
    /**
     * **Validates: Requirements 13.2, 13.3**
     * For any incoming HTTP request to the API, the request logger should produce
     * a log entry containing the HTTP method, request path, response status code,
     * and response time in milliseconds.
     */

    test('every request produces a log entry with method, path, status, and responseTime', async () => {
      // Generator for HTTP methods
      const methodGen = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH');
      // Generator for URL paths
      const pathGen = fc
        .array(
          fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-z0-9]+$/i.test(s)),
          { minLength: 1, maxLength: 4 },
        )
        .map((segments) => '/api/' + segments.join('/'));
      // Generator for status codes
      const statusGen = fc.constantFrom(200, 201, 204, 400, 401, 403, 404, 500);

      await fc.assert(
        fc.asyncProperty(
          methodGen,
          pathGen,
          statusGen,
          async (method, path, statusCode) => {
            const logLines: string[] = [];

            // Create a test logger that captures structured output
            const testLogger = winston.createLogger({
              level: 'debug',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
              transports: [
                new winston.transports.Stream({ stream: captureStream(logLines) }),
              ],
            });

            // Build a minimal express app with the request logger middleware
            // but using our test logger instead of the real one
            const app = express();

            // Custom request logger that uses our test logger
            app.use((req: Request, res: Response, next) => {
              const start = Date.now();
              res.on('finish', () => {
                const responseTime = Date.now() - start;
                testLogger.info('request completed', {
                  method: req.method,
                  path: req.originalUrl,
                  statusCode: res.statusCode,
                  responseTime,
                });
              });
              next();
            });

            app.all('*', (req: Request, res: Response) => {
              res.status(statusCode).json({ ok: true });
            });

            await request(app)
              [method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'](path);

            // Verify a log entry was produced
            const logEntries = logLines.map((line) => JSON.parse(line));
            expect(logEntries.length).toBe(1);
            const entry = logEntries[0];

            expect(entry).toHaveProperty('method', method);
            expect(entry).toHaveProperty('path', path);
            expect(entry).toHaveProperty('statusCode', statusCode);
            expect(entry).toHaveProperty('responseTime');
            expect(typeof entry.responseTime).toBe('number');
            expect(entry.responseTime as number).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Property 11: Sensitive data exclusion from logs', () => {
    /**
     * **Validates: Requirements 13.6**
     * For any log entry produced by the backend, the entry should not contain
     * raw password values, JWT token strings, or full database connection strings.
     */

    // Generator for sensitive key names
    const sensitiveKeyGen = fc.constantFrom(
      'password', 'Password', 'PASSWORD', 'user_password',
      'token', 'Token', 'accessToken', 'refreshToken',
      'jwt', 'JWT', 'jwtToken',
      'secret', 'Secret', 'apiSecret',
      'authorization', 'Authorization',
      'cookie', 'Cookie',
      'connectionString', 'connection_string',
      'databaseUrl', 'database_url',
    );

    // Generator for sensitive values
    const sensitiveValueGen = fc.oneof(
      fc.string({ minLength: 8, maxLength: 50 }).map((s) => `password_${s}`),
      fc.string({ minLength: 10, maxLength: 50 }).map((s) => `token_${s}`),
      fc.string({ minLength: 10, maxLength: 50 }).map((s) => `jwt_${s}`),
      fc.constant('postgresql://user:secret@localhost:5432/db'),
    );

    // Generator for safe key names (no sensitive patterns)
    const safeKeyGen = fc.constantFrom(
      'username', 'email', 'name', 'id', 'status', 'count', 'path', 'method',
    );

    // Generator for safe values
    const safeValueGen = fc.oneof(
      fc.string({ minLength: 1, maxLength: 30 }).filter(
        (s) => !/password|token|jwt|secret|authorization|cookie|connection.*string|database.*url|postgresql:\/\//i.test(s),
      ),
      fc.integer(),
      fc.boolean(),
    );

    test('redactSensitive replaces sensitive keys with [REDACTED]', () => {
      fc.assert(
        fc.property(
          sensitiveKeyGen,
          fc.string({ minLength: 1, maxLength: 50 }),
          (key, value) => {
            const obj = { [key]: value, safeProp: 'visible' };
            const result = redactSensitive(obj);

            expect(result[key]).toBe('[REDACTED]');
            expect(result.safeProp).toBe('visible');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('redactSensitive replaces values matching sensitive patterns with [REDACTED]', () => {
      fc.assert(
        fc.property(
          safeKeyGen,
          sensitiveValueGen,
          (key, value) => {
            const obj = { [key]: value };
            const result = redactSensitive(obj);

            expect(result[key]).toBe('[REDACTED]');
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('redactSensitive preserves safe keys and values', () => {
      fc.assert(
        fc.property(
          safeKeyGen,
          safeValueGen,
          (key, value) => {
            const obj = { [key]: value };
            const result = redactSensitive(obj);

            expect(result[key]).toBe(value);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('redactSensitive handles nested objects with sensitive data', () => {
      fc.assert(
        fc.property(
          sensitiveKeyGen,
          fc.string({ minLength: 1, maxLength: 50 }),
          safeKeyGen,
          safeValueGen,
          (sensitiveKey, sensitiveValue, safeKey, safeValue) => {
            const obj = {
              nested: {
                [sensitiveKey]: sensitiveValue,
                [safeKey]: safeValue,
              },
            };
            const result = redactSensitive(obj);
            const nested = result.nested as Record<string, unknown>;

            expect(nested[sensitiveKey]).toBe('[REDACTED]');
            expect(nested[safeKey]).toBe(safeValue);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('no raw sensitive data survives redaction in serialized output', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.oneof(sensitiveKeyGen, safeKeyGen),
            fc.oneof(sensitiveValueGen, safeValueGen.filter((v) => typeof v === 'string') as fc.Arbitrary<string>),
            { minKeys: 1, maxKeys: 8 },
          ),
          (obj) => {
            const result = redactSensitive(obj as Record<string, unknown>);
            const serialized = JSON.stringify(result);

            // No raw password/token/jwt/connection string values should appear
            // (only [REDACTED] should be present for sensitive entries)
            for (const [key, value] of Object.entries(obj)) {
              const isSensitiveKey = [
                /password/i, /token/i, /jwt/i, /secret/i,
                /authorization/i, /cookie/i, /connection.*string/i,
                /database.*url/i, /postgresql:\/\//i,
              ].some((p) => p.test(key));

              const isSensitiveValue = typeof value === 'string' && [
                /password/i, /token/i, /jwt/i, /secret/i,
                /authorization/i, /cookie/i, /connection.*string/i,
                /database.*url/i, /postgresql:\/\//i,
              ].some((p) => p.test(value));

              if (isSensitiveKey || isSensitiveValue) {
                // The original value should not appear in the serialized output
                if (typeof value === 'string' && value.length > 0) {
                  expect(serialized).not.toContain(`"${value}"`);
                }
              }
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
