/**
 * Feature: security-audit-guardrails, Property 6: Token version invalidation round-trip
 *
 * **Validates: Requirements 3.3, 3.4**
 *
 * For any user, if a valid JWT is issued, then the user's password is changed
 * (incrementing tokenVersion), then the original JWT is presented for authentication,
 * the auth middleware shall reject the token with HTTP 401. A newly issued JWT after
 * the password change shall be accepted.
 */
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, UserForToken } from '../src/services/auth/jwtService';

// Mock prisma before importing auth middleware
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../src/lib/prisma';
import { authenticateToken, AuthRequest } from '../src/middleware/auth';
import { Response, NextFunction } from 'express';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

function createMockReqResNext(token: string) {
  const req = {
    headers: { authorization: `Bearer ${token}` },
    user: undefined,
  } as unknown as AuthRequest;

  let statusCode = 0;
  let jsonBody: Record<string, unknown> = {};
  const res = {
    status: jest.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation((body: Record<string, unknown>) => {
      jsonBody = body;
      return res;
    }),
  } as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = jest.fn().mockImplementation(() => {
    nextCalled = true;
  });

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
    wasNextCalled: () => nextCalled,
  };
}

describe('Feature: security-audit-guardrails, Property 6: Token version invalidation round-trip', () => {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('old token is rejected after tokenVersion increment, new token is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),           // userId
        fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),     // username
        fc.constantFrom('user', 'admin'),                // role
        fc.integer({ min: 0, max: 100 }),                // initial tokenVersion
        async (userId, username, role, initialVersion) => {
          // Step 1: Issue a token with the initial tokenVersion
          const user: UserForToken = {
            id: String(userId),
            username,
            role,
            tokenVersion: initialVersion,
          };
          const oldToken = generateToken(user);

          // Verify the old token contains the correct tokenVersion
          const decoded = verifyToken(oldToken);
          expect(decoded).not.toBeNull();
          expect(decoded!.tokenVersion).toBe(initialVersion);

          // Step 2: Simulate password change — tokenVersion incremented in DB
          const newVersion = initialVersion + 1;

          // Step 3: Old token should be rejected by auth middleware
          // (DB returns newVersion, token has initialVersion → mismatch)
          (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
            tokenVersion: newVersion,
          });

          const oldReq = createMockReqResNext(oldToken);
          await authenticateToken(oldReq.req, oldReq.res, oldReq.next);

          expect(oldReq.wasNextCalled()).toBe(false);
          expect(oldReq.getStatusCode()).toBe(401);

          // Step 4: Issue a new token with the updated tokenVersion
          const updatedUser: UserForToken = {
            id: String(userId),
            username,
            role,
            tokenVersion: newVersion,
          };
          const newToken = generateToken(updatedUser);

          // Step 5: New token should be accepted by auth middleware
          (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
            tokenVersion: newVersion,
          });

          const newReq = createMockReqResNext(newToken);
          await authenticateToken(newReq.req, newReq.res, newReq.next);

          expect(newReq.wasNextCalled()).toBe(true);
          expect(newReq.req.user).toBeDefined();
          expect(newReq.req.user!.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('token with matching tokenVersion is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),
        fc.constantFrom('user', 'admin'),
        fc.integer({ min: 0, max: 100 }),
        async (userId, username, role, version) => {
          const user: UserForToken = {
            id: String(userId),
            username,
            role,
            tokenVersion: version,
          };
          const token = generateToken(user);

          // DB returns same version as token → should accept
          (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
            tokenVersion: version,
          });

          const { req, res, next, wasNextCalled } = createMockReqResNext(token);
          await authenticateToken(req, res, next);

          expect(wasNextCalled()).toBe(true);
          expect(req.user).toBeDefined();
          expect(req.user!.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
