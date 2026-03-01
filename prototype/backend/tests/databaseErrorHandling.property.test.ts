// Feature: user-registration-module, Property 21: Database Error Handling
import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Prisma } from '@prisma/client';
import authRoutes from '../src/routes/auth';
import * as userService from '../src/services/userService';

dotenv.config();

// Create test app with auth routes
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// Lower NUM_RUNS since we're testing error paths with mocks
const NUM_RUNS = 20;

/**
 * Database error factories — each produces a Prisma-like error that the
 * registration endpoint's catch block should handle gracefully.
 */
const databaseErrorFactories: Array<{ name: string; create: () => Error }> = [
  {
    name: 'PrismaClientKnownRequestError (connection)',
    create: () =>
      new Prisma.PrismaClientKnownRequestError('Connection refused to database server at `db:5432`', {
        code: 'P1001',
        clientVersion: '5.22.0',
      }),
  },
  {
    name: 'PrismaClientKnownRequestError (timeout)',
    create: () =>
      new Prisma.PrismaClientKnownRequestError(
        'Timed out fetching a new connection from the connection pool. More info: https://pris.ly/d/connection-pool (Current connection pool timeout: 10)',
        { code: 'P2024', clientVersion: '5.22.0' },
      ),
  },
  {
    name: 'PrismaClientUnknownRequestError',
    create: () =>
      new Prisma.PrismaClientUnknownRequestError(
        'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: RawDatabaseError { code: "XX000", message: "could not write to WAL" } })',
        { clientVersion: '5.22.0' },
      ),
  },
  {
    name: 'PrismaClientInitializationError',
    create: () =>
      new Prisma.PrismaClientInitializationError(
        'Can\'t reach database server at `db`:`5432`\n\nPlease make sure your database server is running at `db`:`5432`.',
        '5.22.0',
      ),
  },
];

/**
 * Sensitive keywords that must NEVER appear in error responses sent to the user.
 * These indicate internal database details leaking through.
 */
const SENSITIVE_KEYWORDS = [
  'prisma',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'FROM',
  'WHERE',
  'TABLE',
  'COLUMN',
  'constraint',
  'stack',
  'at Object',
  'at Module',
  'at Function',
  'node_modules',
  '.ts:',
  '.js:',
  'ConnectorError',
  'RawDatabaseError',
  'connection pool',
  'WAL',
  'P1001',
  'P2024',
  'XX000',
];

describe('Database Error Handling - Property Tests', () => {
  // Restore all mocks after each test to avoid leaking between tests
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Property 21: Database Error Handling', () => {
    /**
     * **Validates: Requirements 9.1**
     *
     * For any database error occurring during registration (e.g., connection failure,
     * constraint violation), the system should return a generic error message to the
     * user without exposing internal database details.
     */
    test('database errors during findUserByUsername return 500 with generic message', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.integer({ min: 0, max: databaseErrorFactories.length - 1 }),
          async (username, email, password, errorIndex) => {
            // Mock findUserByUsername to throw a database error
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockRejectedValue(
              databaseErrorFactories[errorIndex].create(),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should return a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Error message must NOT contain any sensitive database details
            const errorLower = res.body.error.toLowerCase();
            const bodyStr = JSON.stringify(res.body).toLowerCase();
            for (const keyword of SENSITIVE_KEYWORDS) {
              expect(bodyStr).not.toContain(keyword.toLowerCase());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('database errors during createUser return 500 with generic message', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.integer({ min: 0, max: databaseErrorFactories.length - 1 }),
          async (username, email, password, errorIndex) => {
            // findUserByUsername and findUserByEmail succeed (no duplicates)
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockResolvedValue(null);
            jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(null);
            // createUser throws a database error
            jest.spyOn(userService, 'createUser').mockRejectedValue(
              databaseErrorFactories[errorIndex].create(),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should return a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Error message must NOT contain any sensitive database details
            const bodyStr = JSON.stringify(res.body).toLowerCase();
            for (const keyword of SENSITIVE_KEYWORDS) {
              expect(bodyStr).not.toContain(keyword.toLowerCase());
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('database errors during findUserByEmail return 500 with generic message', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUsernameArbitrary(),
          validEmailArbitrary(),
          validPasswordArbitrary(),
          fc.integer({ min: 0, max: databaseErrorFactories.length - 1 }),
          async (username, email, password, errorIndex) => {
            // findUserByUsername succeeds (no duplicate), findUserByEmail throws
            jest.restoreAllMocks();
            jest.spyOn(userService, 'findUserByUsername').mockResolvedValue(null);
            jest.spyOn(userService, 'findUserByEmail').mockRejectedValue(
              databaseErrorFactories[errorIndex].create(),
            );

            const res = await request(app)
              .post('/api/auth/register')
              .send({ username, email, password });

            // Should return 500
            expect(res.status).toBe(500);

            // Should return a generic error message
            expect(res.body).toHaveProperty('error');
            expect(typeof res.body.error).toBe('string');
            expect(res.body.error.length).toBeGreaterThan(0);

            // Error message must NOT contain any sensitive database details
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
