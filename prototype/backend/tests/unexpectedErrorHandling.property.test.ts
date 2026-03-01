// Feature: user-registration-module, Property 23: Unexpected Error Handling
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';
import * as userService from '../src/services/userService';

dotenv.config();

// Create test app with auth routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

const NUM_RUNS = 20;

/**
 * Unexpected error factories — each produces a non-Prisma, non-validation error
 * that the registration endpoint's catch block should handle gracefully.
 */
const unexpectedErrorFactories: Array<{ name: string; create: (msg: string) => Error }> = [
  {
    name: 'TypeError',
    create: (msg: string) => new TypeError(msg),
  },
  {
    name: 'RangeError',
    create: (msg: string) => new RangeError(msg),
  },
  {
    name: 'Generic Error',
    create: (msg: string) => new Error(msg),
  },
  {
    name: 'ReferenceError',
    create: (msg: string) => new ReferenceError(msg),
  },
  {
    name: 'SyntaxError',
    create: (msg: string) => new SyntaxError(msg),
  },
];

/**
 * Sensitive keywords that must NEVER appear in error responses sent to the user.
 * These indicate internal implementation details leaking through.
 */
const SENSITIVE_KEYWORDS = [
  'stack',
  'at Object',
  'at Module',
  'at Function',
  'node_modules',
  '.ts:',
  '.js:',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'Cannot read',
  'is not defined',
  'is not a function',
  'undefined',
  'null',
];

describe('Unexpected Error Handling - Property Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Property 23: Unexpected Error Handling', () => {
    /**
     * **Validates: Requirements 9.3**
     *
     * For any unexpected error during registration (not validation or database errors),
     * the system should return a generic error message to the user while logging the
     * detailed error information server-side.
     */
    test('unexpected errors during findUserByUsername return 500 with generic message and INTERNAL_ERROR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.string({ minLength: 5, maxLength: 80 }),
          fc.integer({ min: 0, max: unexpectedErrorFactories.length - 1 }),
          async (username, email, password, errorMessage, errorIndex) => {
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockRejectedValue(
              unexpectedErrorFactories[errorIndex].create(errorMessage),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should have a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Should have INTERNAL_ERROR code
            expect(res.body).toHaveProperty('code', 'INTERNAL_ERROR');

            // Error message must NOT contain the original error details
            expect(res.body.error).not.toContain(errorMessage);

            // Response body must NOT contain any sensitive implementation details
            const bodyStr = JSON.stringify(res.body).toLowerCase();
            for (const keyword of SENSITIVE_KEYWORDS) {
              expect(bodyStr).not.toContain(keyword.toLowerCase());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('unexpected errors during findUserByEmail return 500 with generic message and INTERNAL_ERROR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.string({ minLength: 5, maxLength: 80 }),
          fc.integer({ min: 0, max: unexpectedErrorFactories.length - 1 }),
          async (username, email, password, errorMessage, errorIndex) => {
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockResolvedValue(null);
            jest.spyOn(userService, 'findUserByEmail').mockRejectedValue(
              unexpectedErrorFactories[errorIndex].create(errorMessage),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should have a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Should have INTERNAL_ERROR code
            expect(res.body).toHaveProperty('code', 'INTERNAL_ERROR');

            // Error message must NOT contain the original error details
            expect(res.body.error).not.toContain(errorMessage);

            // Response body must NOT contain any sensitive implementation details
            const bodyStr = JSON.stringify(res.body).toLowerCase();
            for (const keyword of SENSITIVE_KEYWORDS) {
              expect(bodyStr).not.toContain(keyword.toLowerCase());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('unexpected errors during createUser return 500 with generic message and INTERNAL_ERROR code', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.string({ minLength: 5, maxLength: 80 }),
          fc.integer({ min: 0, max: unexpectedErrorFactories.length - 1 }),
          async (username, email, password, errorMessage, errorIndex) => {
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockResolvedValue(null);
            jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(null);
            jest.spyOn(userService, 'createUser').mockRejectedValue(
              unexpectedErrorFactories[errorIndex].create(errorMessage),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should have a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Should have INTERNAL_ERROR code
            expect(res.body).toHaveProperty('code', 'INTERNAL_ERROR');

            // Error message must NOT contain the original error details
            expect(res.body.error).not.toContain(errorMessage);

            // Response body must NOT contain any sensitive implementation details
            const bodyStr = JSON.stringify(res.body).toLowerCase();
            for (const keyword of SENSITIVE_KEYWORDS) {
              expect(bodyStr).not.toContain(keyword.toLowerCase());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});

// ============================================================================
// Test Data Generators
// ============================================================================

/** Generate valid usernames (3-20 chars, alphanumeric + underscore + hyphen) */
function validUsernameArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
      { minLength: 3, maxLength: 20 },
    )
    .map((chars) => chars.join(''));
}

/** Generate valid emails (e.g. ab3@x.co) fitting within 20 chars */
function validEmailArbitrary(): fc.Arbitrary<string> {
  const localPart = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 3 })
    .map((chars) => chars.join(''));
  const domain = fc.constantFrom('a', 'b', 'x', 'z');
  const tld = fc.constantFrom('co', 'io');
  return fc.tuple(localPart, domain, tld).map(([l, d, t]) => `${l}@${d}.${t}`);
}

/** Generate valid passwords (8-32 chars) */
function validPasswordArbitrary(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'.split(''),
      ),
      { minLength: 8, maxLength: 32 },
    )
    .map((chars) => chars.join(''));
}
