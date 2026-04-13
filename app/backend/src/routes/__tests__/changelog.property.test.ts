/**
 * Property-based tests for changelog API input validation.
 *
 * Feature: in-game-changelog, Property 13: API input validation rejects invalid data
 *
 * **Validates: Requirements 1.2, 1.3, 1.7, 10.1, 10.2, 10.3, 10.4, 10.5**
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockChangelogService = {
  listPublished: jest.fn(),
  getUnread: jest.fn(),
  getUnreadCount: jest.fn(),
  dismiss: jest.fn(),
  listAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  publish: jest.fn(),
};

const mockProcessAndStore = jest.fn();

jest.mock('../../services/changelog', () => ({
  changelogService: mockChangelogService,
  processAndStore: mockProcessAndStore,
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: mockPrismaUser,
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../config/env', () => ({
  getConfig: () => ({
    jwtSecret: 'test-changelog-prop-secret',
    nodeEnv: 'test',
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as fc from 'fast-check';
import changelogRoutes from '../changelog';
import { errorHandler } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-changelog-prop-secret';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/changelog', changelogRoutes);
  app.use(errorHandler);
  return app;
}

function adminToken(userId = 1, tokenVersion = 0): string {
  return jwt.sign(
    { userId, username: 'admin_user', role: 'admin', tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const VALID_CATEGORIES = ['balance', 'feature', 'bugfix', 'economy'] as const;

// ---------------------------------------------------------------------------
// Property 13: API input validation rejects invalid data with field-level errors
// ---------------------------------------------------------------------------

describe('Property 13: API input validation rejects invalid data with field-level errors', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaUser.findUnique.mockResolvedValue({
      tokenVersion: 0,
      stableName: 'Test Stable',
    });
    mockChangelogService.create.mockResolvedValue({ id: 1, title: 'x', body: 'x', category: 'feature', status: 'draft' });
    mockChangelogService.update.mockResolvedValue({ id: 1, title: 'x', body: 'x', category: 'feature', status: 'draft' });
  });

  /**
   * For any title that is empty or exceeds 200 characters, the create endpoint
   * returns 400 with field-level error details.
   */
  test('invalid title (empty or >200 chars) on create returns 400', async () => {
    const invalidTitleArb = fc.oneof(
      // Empty string
      fc.constant(''),
      // Too long (201–500 chars)
      fc.string({ minLength: 201, maxLength: 500 }),
    );

    await fc.assert(
      fc.asyncProperty(invalidTitleArb, async (title) => {
        const res = await request(app)
          .post('/api/changelog/admin')
          .set('Authorization', `Bearer ${adminToken()}`)
          .send({ title, body: 'Valid body text', category: 'feature' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toHaveProperty('fields');
        expect(Array.isArray(res.body.details.fields)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  /**
   * For any body that is empty or exceeds 5000 characters, the create endpoint
   * returns 400 with field-level error details.
   */
  test('invalid body (empty or >5000 chars) on create returns 400', async () => {
    const invalidBodyArb = fc.oneof(
      // Empty string
      fc.constant(''),
      // Too long (5001–6000 chars)
      fc.string({ minLength: 5001, maxLength: 6000 }),
    );

    await fc.assert(
      fc.asyncProperty(invalidBodyArb, async (body) => {
        const res = await request(app)
          .post('/api/changelog/admin')
          .set('Authorization', `Bearer ${adminToken()}`)
          .send({ title: 'Valid Title', body, category: 'feature' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toHaveProperty('fields');
      }),
      { numRuns: 20 },
    );
  });

  /**
   * For any category string that is not in the allowed set, the create endpoint
   * returns 400 with field-level error details.
   */
  test('invalid category on create returns 400', async () => {
    const invalidCategoryArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !(VALID_CATEGORIES as readonly string[]).includes(s));

    await fc.assert(
      fc.asyncProperty(invalidCategoryArb, async (category) => {
        const res = await request(app)
          .post('/api/changelog/admin')
          .set('Authorization', `Bearer ${adminToken()}`)
          .send({ title: 'Valid Title', body: 'Valid body', category });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toHaveProperty('fields');
      }),
      { numRuns: 20 },
    );
  });

  /**
   * For any ID parameter that is not a positive integer (zero, negative, float,
   * non-numeric), the update/delete/publish endpoints return 400.
   */
  test('non-positive-integer ID param returns 400', async () => {
    const invalidIdArb = fc.oneof(
      fc.constant('0'),
      fc.integer({ min: -10000, max: -1 }).map(String),
      fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true })
        .filter((n) => !Number.isInteger(n))
        .map(String),
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/),
    );

    await fc.assert(
      fc.asyncProperty(invalidIdArb, async (invalidId) => {
        // Test on PUT (update)
        const res = await request(app)
          .put(`/api/changelog/admin/${invalidId}`)
          .set('Authorization', `Bearer ${adminToken()}`)
          .send({ title: 'Updated' });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details).toHaveProperty('fields');
      }),
      { numRuns: 20 },
    );
  });

  /**
   * For any combination of invalid fields on the create endpoint, the response
   * includes field-level error details identifying which fields failed.
   */
  test('multiple invalid fields produce field-level errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.oneof(fc.constant(''), fc.string({ minLength: 201, maxLength: 300 })),
          body: fc.oneof(fc.constant(''), fc.string({ minLength: 5001, maxLength: 5500 })),
          category: fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => !(VALID_CATEGORIES as readonly string[]).includes(s),
          ),
        }),
        async ({ title, body, category }) => {
          const res = await request(app)
            .post('/api/changelog/admin')
            .set('Authorization', `Bearer ${adminToken()}`)
            .send({ title, body, category });

          expect(res.status).toBe(400);
          expect(res.body.code).toBe('VALIDATION_ERROR');
          expect(res.body.details).toHaveProperty('fields');
          expect(res.body.details.fields.length).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});
