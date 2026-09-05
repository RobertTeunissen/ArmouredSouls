/**
 * Unit tests for admin password reset and user search routes.
 *
 * Tests the POST /api/admin/users/:id/reset-password endpoint covering:
 * successful reset, validation errors, auth failures, rate limiting, and
 * invalid userId handling.
 *
 * Requirements: 11.2
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

// Mock the PasswordResetService
const mockResetPassword = jest.fn();
jest.mock('../src/services/auth/passwordResetService', () => ({
  resetPassword: mockResetPassword,
}));

// Mock validatePassword
const mockValidatePassword = jest.fn();
jest.mock('../src/utils/validation', () => ({
  validatePassword: mockValidatePassword,
}));

// Mock securityMonitor
const mockSecurityMonitor = {
  trackRateLimitViolation: jest.fn(),
  logValidationFailure: jest.fn(),
  logAuthorizationFailure: jest.fn(),
  logAdminAccess: jest.fn(),
  setStableName: jest.fn(),
};
jest.mock('../src/services/security/securityMonitor', () => ({
  securityMonitor: mockSecurityMonitor,
  SecuritySeverity: { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' },
}));

// Mock prisma (needed by auth middleware and user search route)
const mockPrismaUser = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};
// `users/search` also matches on robot name, and it does so against the robot
// delegate directly rather than through a relation filter on User. Without this the
// handler threw on `prisma.robot.findMany` being undefined and every search test
// saw a 500.
const mockPrismaRobot = {
  findMany: jest.fn().mockResolvedValue([]),
};
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: mockPrismaUser,
    robot: mockPrismaRobot,
    $disconnect: jest.fn(),
  },
}));

// Mock logger to suppress output during tests
jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock config/env for JWT secret
jest.mock('../src/config/env', () => ({
  getConfig: () => ({
    jwtSecret: 'test-secret-key',
    nodeEnv: 'test',
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import adminRoutes from '../src/routes/admin';
import { errorHandler } from '../src/middleware/errorHandler';
import { AuthError } from '../src/errors/authErrors';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

// Reuse one listening server: this file has hundreds of property-test requests,
// and passing the unbound app to Supertest creates an ephemeral listener per call.
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

afterAll(
  () => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }),
);

const JWT_SECRET = 'test-secret-key';

/** Generate a valid admin JWT token */
function adminToken(userId = 1, tokenVersion = 0): string {
  return jwt.sign(
    { userId, username: 'admin_user', role: 'admin', tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

/**
 * A token for an admin nobody else in this file uses.
 *
 * `requireAdmin` runs a real express-rate-limit bucket keyed on the admin's user id,
 * 120 requests per minute. A 100-iteration property sharing id 1 with the rest of
 * the file exhausts that budget and starts receiving 429s. Property 8 failed on it
 * outright; properties 6 and 7 guard with `if (res.status === 200)` and so were
 * quietly asserting nothing once the budget ran out. A fresh id per iteration gives
 * each one its own bucket. Throttling itself is covered by its own 429 test.
 */
let nextIsolatedAdminId = 1000;
function isolatedAdminToken(): string {
  return adminToken(nextIsolatedAdminId++);
}

/** Generate a non-admin JWT token */
function userToken(userId = 2, tokenVersion = 0): string {
  return jwt.sign(
    { userId, username: 'regular_user', role: 'user', tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/users/:id/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRobot.findMany.mockResolvedValue([]);

    // Default: authenticateToken passes (user exists with matching tokenVersion)
    // `role` comes from the database row, not the JWT claim: authenticateToken sets
    // `req.user.role` from `prisma.user.findUnique`, so a role change takes effect
    // without reissuing a token. The row therefore has to carry it, and it has to be
    // routed on user id — id 2 is the regular player, every other id is an admin.
    // A single flat `role: 'admin'` would make the non-admin case pass as an admin;
    // no role at all makes `requireAdmin` answer 403 to everything.
    mockPrismaUser.findUnique.mockImplementation(
      ({ where }: { where: { id: number } }) =>
        Promise.resolve({
          tokenVersion: 0,
          stableName: 'Test Stable',
          role: where.id === 2 ? 'user' : 'admin',
        }),
    );

    // Default: validatePassword passes
    mockValidatePassword.mockReturnValue({ valid: true });

    // Default: resetPassword succeeds
    mockResetPassword.mockResolvedValue({ userId: 42, username: 'player1' });
  });

  // -----------------------------------------------------------------------
  // Auth tests first — these fail early in the middleware chain.
  // The rate limiter runs AFTER authenticateToken, so it's keyed by
  // the admin's userId (truly per-admin, not per-IP).
  // -----------------------------------------------------------------------

  describe('authentication and authorization', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not an admin', async () => {
      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });

  describe('successful reset', () => {
    it('should return 200 with userId and username on successful reset', async () => {
      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        userId: 42,
        username: 'player1',
      });

      // Verify resetPassword was called with correct args
      expect(mockResetPassword).toHaveBeenCalledWith(
        42,
        'ValidPass1',
        { initiatorId: 1, resetType: 'admin' },
      );
    });
  });

  describe('validation errors', () => {
    it('should return 400 when password field is missing', async () => {
      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 with specific message when password fails validatePassword()', async () => {
      mockValidatePassword.mockReturnValue({
        valid: false,
        error: 'Password must be at least 8 characters',
      });

      const res = await request(server)
        .post('/api/admin/users/42/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid userId values (zero, negative, non-integer)', async () => {
      // Test zero
      const resZero = await request(server)
        .post('/api/admin/users/0/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'ValidPass1' });
      expect(resZero.status).toBe(400);
      expect(resZero.body).toHaveProperty('code', 'VALIDATION_ERROR');

      // Test negative
      const resNeg = await request(server)
        .post('/api/admin/users/-5/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'ValidPass1' });
      expect(resNeg.status).toBe(400);

      // Test non-integer (float)
      const resFloat = await request(server)
        .post('/api/admin/users/3.14/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'ValidPass1' });
      expect(resFloat.status).toBe(400);
    });
  });

  describe('user not found', () => {
    it('should return 404 when target user does not exist', async () => {
      mockResetPassword.mockRejectedValue(
        new AuthError('USER_NOT_FOUND', 'User not found', 404),
      );

      const res = await request(server)
        .post('/api/admin/users/999/reset-password')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ password: 'ValidPass1' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });
  });

  // -----------------------------------------------------------------------
  // Rate limiting — the limiter runs after auth, keyed by admin userId.
  // -----------------------------------------------------------------------

  describe('rate limiting', () => {
    it('should return 429 with retryAfter when rate limit is exceeded', async () => {
      const token = adminToken();
      let lastRes: request.Response | undefined;

      // Keep sending until we get a 429 (the prior tests already consumed
      // some of the 10-request budget from the same IP)
      for (let i = 0; i < 15; i++) {
        lastRes = await request(server)
          .post('/api/admin/users/42/reset-password')
          .set('Authorization', `Bearer ${token}`)
          .send({ password: 'ValidPass1' });

        if (lastRes.status === 429) break;
      }

      expect(lastRes!.status).toBe(429);
      expect(lastRes!.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(lastRes!.body.retryAfter).toBe(900);
    });
  });
});


/**
 * Unit tests for admin user search route.
 *
 * Tests the GET /api/admin/users/search endpoint covering:
 * partial username/email search, exact ID search, empty results,
 * validation errors, and safe field filtering.
 *
 * Requirements: 11.3
 */
describe('GET /api/admin/users/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRobot.findMany.mockResolvedValue([]);

    // Default: authenticateToken passes (user exists with matching tokenVersion)
    // `role` comes from the database row, not the JWT claim: authenticateToken sets
    // `req.user.role` from `prisma.user.findUnique`, so a role change takes effect
    // without reissuing a token. The row therefore has to carry it, and it has to be
    // routed on user id — id 2 is the regular player, every other id is an admin.
    // A single flat `role: 'admin'` would make the non-admin case pass as an admin;
    // no role at all makes `requireAdmin` answer 403 to everything.
    mockPrismaUser.findUnique.mockImplementation(
      ({ where }: { where: { id: number } }) =>
        Promise.resolve({
          tokenVersion: 0,
          stableName: 'Test Stable',
          role: where.id === 2 ? 'user' : 'admin',
        }),
    );

    // Default: findMany returns empty
    mockPrismaUser.findMany.mockResolvedValue([]);
  });

  it('should return users matching a partial username', async () => {
    const matchedUser = { id: 10, username: 'player1', email: 'p1@example.com', stableName: 'Iron Fist' };

    // q is not numeric → idResults = []
    // username search returns match, email search returns empty
    mockPrismaUser.findMany
      .mockResolvedValueOnce([matchedUser])  // username search
      .mockResolvedValueOnce([]);            // email search

    const res = await request(server)
      .get('/api/admin/users/search?q=play')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toEqual(matchedUser);
  });

  it('should return users matching a partial email', async () => {
    const matchedUser = { id: 20, username: 'warrior', email: 'warrior@test.com', stableName: 'Steel Forge' };

    // q is not numeric → idResults = []
    // username search returns empty, email search returns match
    mockPrismaUser.findMany
      .mockResolvedValueOnce([])             // username search
      .mockResolvedValueOnce([matchedUser]); // email search

    const res = await request(server)
      .get('/api/admin/users/search?q=warrior@')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toEqual(matchedUser);
  });

  it('should return user matching an exact numeric user ID', async () => {
    const matchedUser = { id: 42, username: 'target', email: 'target@example.com', stableName: 'Bolt Arena' };

    // q is numeric → idResults search, then username search, then email search
    mockPrismaUser.findMany
      .mockResolvedValueOnce([matchedUser])  // id search
      .mockResolvedValueOnce([])             // username search
      .mockResolvedValueOnce([]);            // email search

    const res = await request(server)
      .get('/api/admin/users/search?q=42')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toEqual(matchedUser);
  });

  it('should return empty array when no users match', async () => {
    // All searches return empty
    mockPrismaUser.findMany.mockResolvedValue([]);

    const res = await request(server)
      .get('/api/admin/users/search?q=nonexistent')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it('should return 400 when query exceeds 50 characters', async () => {
    const longQuery = 'a'.repeat(51);

    const res = await request(server)
      .get(`/api/admin/users/search?q=${longQuery}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
  });

  it('should return 400 when query is empty', async () => {
    const res = await request(server)
      .get('/api/admin/users/search?q=')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
  });

  it('should return only safe fields (no passwordHash or tokenVersion)', async () => {
    const safeUser = { id: 5, username: 'safe_user', email: 'safe@example.com', stableName: 'Safe Stable' };

    mockPrismaUser.findMany
      .mockResolvedValueOnce([safeUser])  // username search
      .mockResolvedValueOnce([]);         // email search

    const res = await request(server)
      .get('/api/admin/users/search?q=safe')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);

    const returnedUser = res.body.users[0];
    expect(Object.keys(returnedUser).sort()).toEqual(['email', 'id', 'stableName', 'username']);
    expect(returnedUser).not.toHaveProperty('passwordHash');
    expect(returnedUser).not.toHaveProperty('tokenVersion');
  });
});


// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates valid passwords (8–128 chars) that satisfy the character class
 * requirements: at least one uppercase letter, one lowercase letter, and one
 * digit.
 */
function validPasswordArb(): fc.Arbitrary<string> {
  const upper = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  const lower = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''));
  const digit = fc.constantFrom(...'0123456789'.split(''));
  const anyChar = fc.oneof(upper, lower, digit, fc.constantFrom('!', '@', '#', '_', '-', '.'));

  return fc
    .tuple(
      upper,
      lower,
      digit,
      fc.array(anyChar, { minLength: 5, maxLength: 125 }),
    )
    .map(([u, l, d, rest]) => {
      const chars = [u, l, d, ...rest];
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    });
}

// ---------------------------------------------------------------------------
// Property-Based Test Suite
// ---------------------------------------------------------------------------

describe('Admin Password Reset Routes — Property-Based Tests', () => {
  // Get the real validatePassword function (bypassing the mock)
  const { validatePassword: realValidatePassword } = jest.requireActual<
    typeof import('../src/utils/validation')
  >('../src/utils/validation');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaRobot.findMany.mockResolvedValue([]);

    // Default: authenticateToken passes
    // `role` comes from the database row, not the JWT claim: authenticateToken sets
    // `req.user.role` from `prisma.user.findUnique`, so a role change takes effect
    // without reissuing a token. The row therefore has to carry it, and it has to be
    // routed on user id — id 2 is the regular player, every other id is an admin.
    // A single flat `role: 'admin'` would make the non-admin case pass as an admin;
    // no role at all makes `requireAdmin` answer 403 to everything.
    mockPrismaUser.findUnique.mockImplementation(
      ({ where }: { where: { id: number } }) =>
        Promise.resolve({
          tokenVersion: 0,
          stableName: 'Test Stable',
          role: where.id === 2 ? 'user' : 'admin',
        }),
    );

    // Default: resetPassword succeeds
    mockResetPassword.mockResolvedValue({ userId: 42, username: 'player1' });
  });

  /**
   * **Property 1: Password validation delegation**
   *
   * For any string `s`, the API accepts `s` if and only if
   * `validatePassword(s)` returns `{ valid: true }`.
   *
   * Each iteration uses its own admin id so it gets its own rate-limit bucket. This
   * used to share one id and tolerate 429 instead, which meant everything after the
   * tenth iteration asserted nothing at all — the property looked like it ran 100
   * cases and effectively ran 10.
   *
   * **Validates: Requirements 2.4, 3.2, 3.5**
   */
  test('Property 1: route accepts password iff validatePassword returns valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 200 }),
        async (password) => {
          const realResult = realValidatePassword(password);

          // Set the mock to return the real validation result
          mockValidatePassword.mockReturnValue(realResult);
          mockResetPassword.mockResolvedValue({ userId: 42, username: 'player1' });

          const res = await request(server)
            .post('/api/admin/users/42/reset-password')
            .set('Authorization', `Bearer ${isolatedAdminToken()}`)
            .send({ password });

          if (realResult.valid) {
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
          } else {
            expect(res.status).toBe(400);
            expect(res.body.error).toBe(realResult.error);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 2: Invalid userId rejection**
   *
   * For any value that is not a positive integer (zero, negatives, floats,
   * non-numeric strings), the API returns 400.
   *
   * The rate limiter from earlier tests may be exhausted, so numeric-looking
   * invalid IDs (0, -1) could get 429 instead of 400. We test two categories:
   * - Non-numeric strings: always bypass the rate limiter bucket and get 400
   *   from Zod validation
   * - Numeric invalids (zero, negatives, floats): accept either 400 or 429
   *   since both represent rejection of the invalid userId
   *
   * **Validates: Requirements 3.4**
   */
  test('Property 2: non-positive-integer userId always returns 400', async () => {
    mockValidatePassword.mockReturnValue({ valid: true });

    const invalidUserIdArb = fc.oneof(
      // Zero
      fc.constant('0'),
      // Negative integers
      fc.integer({ min: -10000, max: -1 }).map(String),
      // Floats (non-integer)
      fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true })
        .filter((n) => !Number.isInteger(n))
        .map(String),
      // Non-numeric strings (at least 1 char, no slashes to avoid route confusion)
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,19}$/),
    );

    await fc.assert(
      fc.asyncProperty(invalidUserIdArb, async (invalidId) => {
        const res = await request(server)
          .post(`/api/admin/users/${invalidId}/reset-password`)
          .set('Authorization', `Bearer ${isolatedAdminToken()}`)
          .send({ password: 'ValidPass1' });

        // 400 exactly. This accepted `[400, 429]` because iterations shared one
        // admin id and exhausted its rate-limit bucket; with a fresh id per
        // iteration a 429 here would be a real defect rather than noise.
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 6: Search result limit invariant**
   *
   * For any search query (1–50 chars), the API returns at most 10 results.
   *
   * **Validates: Requirements 10.2**
   */
  test('Property 6: search always returns at most 10 results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 0, max: 30 }),
        async (query, userCount) => {
          // Generate a batch of mock users
          const users = Array.from({ length: userCount }, (_, i) => ({
            id: i + 1,
            username: `user${i}`,
            email: `user${i}@test.com`,
            stableName: `Stable ${i}`,
          }));

          // Mock all three findMany calls to return the full set
          mockPrismaUser.findMany.mockResolvedValue(users);

          const encodedQuery = encodeURIComponent(query);
          const res = await request(server)
            .get(`/api/admin/users/search?q=${encodedQuery}`)
            .set('Authorization', `Bearer ${isolatedAdminToken()}`);

          // Asserted unconditionally. This was guarded on `res.status === 200`,
          // which silently passed once the shared admin id's rate-limit bucket ran
          // out; the isolated id per iteration removes the need for the guard.
          //
          // Thrown rather than expect()ed so an unexpected status names itself. Each
          // iteration is a real HTTP round trip, and a 100-iteration property under a
          // fully parallel tier has produced a status no code in this repo returns.
          if (res.status !== 200) {
            throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
          }
          expect(res.body.users.length).toBeLessThanOrEqual(10);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 7: Search result field safety**
   *
   * For any search result, the object contains only `id`, `username`,
   * `email`, `stableName`.
   *
   * **Validates: Requirements 10.3**
   */
  test('Property 7: search results contain only safe fields', async () => {
    const allowedFields = ['id', 'username', 'email', 'stableName'];

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 10 }),
        async (query, userCount) => {
          // Return users with ONLY safe fields (as Prisma select would)
          const users = Array.from({ length: userCount }, (_, i) => ({
            id: i + 1,
            username: `user${i}`,
            email: `user${i}@test.com`,
            stableName: `Stable ${i}`,
          }));

          mockPrismaUser.findMany.mockResolvedValue(users);

          const encodedQuery = encodeURIComponent(query);
          const res = await request(server)
            .get(`/api/admin/users/search?q=${encodedQuery}`)
            .set('Authorization', `Bearer ${isolatedAdminToken()}`);

          // See Property 6 on why this is no longer guarded on a 200, and on why the
          // status check throws with the body attached.
          if (res.status !== 200) {
            throw new Error(`expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
          }
          for (const user of res.body.users) {
            const keys = Object.keys(user).sort();
            expect(keys).toEqual(allowedFields.sort());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 8: Search query validation**
   *
   * For any empty string or string >50 chars, the API returns 400.
   *
   * **Validates: Requirements 10.4**
   */
  test('Property 8: empty or >50-char search query returns 400', async () => {
    const invalidQueryArb = fc.oneof(
      // Empty string
      fc.constant(''),
      // Strings longer than 50 characters
      fc.string({ minLength: 51, maxLength: 200 }),
    );

    await fc.assert(
      fc.asyncProperty(invalidQueryArb, async (query) => {
        const encodedQuery = encodeURIComponent(query);
        const res = await request(server)
          .get(`/api/admin/users/search?q=${encodedQuery}`)
          .set('Authorization', `Bearer ${isolatedAdminToken()}`);

        expect(res.status).toBe(400);
      }),
      { numRuns: 100 },
    );
  });
});
