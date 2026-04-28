/**
 * Property 9: DB role takes precedence over JWT role
 *
 * For any request where the JWT payload contains a role value that differs from
 * the user's current role in the database, the authenticateToken middleware SHALL
 * use the database role value for req.user.role, not the JWT-encoded role.
 *
 * **Validates: Requirements 27.1**
 */
import fc from 'fast-check';
import { generateToken, UserForToken } from '../../services/auth/jwtService';

// Mock prisma before importing auth middleware
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock securityMonitor (transitive dependency via auth.ts)
jest.mock('../../services/security/securityMonitor', () => ({
  __esModule: true,
  securityMonitor: {
    setStableName: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    recordEvent: jest.fn(),
    trackRateLimitViolation: jest.fn(),
  },
}));

import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../auth';
import { Response, NextFunction } from 'express';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const ROLES = ['admin', 'user', 'moderator'] as const;

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

describe('Property 9: DB role takes precedence over JWT role', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('req.user.role always equals the DB role, not the JWT role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),             // userId
        fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),       // username
        fc.constantFrom(...ROLES),                         // jwtRole (role encoded in JWT)
        fc.constantFrom(...ROLES),                         // dbRole (role stored in DB)
        fc.integer({ min: 0, max: 100 }),                  // tokenVersion
        async (userId, username, jwtRole, dbRole, tokenVersion) => {
          // Issue a JWT with jwtRole
          const user: UserForToken = {
            id: String(userId),
            username,
            role: jwtRole,
            tokenVersion,
          };
          const token = generateToken(user);

          // DB returns dbRole (which may differ from jwtRole)
          (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
            tokenVersion,
            stableName: null,
            role: dbRole,
          });

          const { req, res, next, wasNextCalled } = createMockReqResNext(token);
          await authenticateToken(req, res, next);

          // Middleware should call next() (valid token + matching tokenVersion)
          expect(wasNextCalled()).toBe(true);
          expect(req.user).toBeDefined();

          // The critical property: req.user.role must equal the DB role,
          // regardless of what role was in the JWT
          expect(req.user!.role).toBe(dbRole);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('req.user.role equals DB role even when JWT and DB roles always differ', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),             // userId
        fc.stringMatching(/^[a-zA-Z0-9_]{3,20}$/),       // username
        fc.constantFrom(...ROLES),                         // jwtRole
        fc.integer({ min: 0, max: 100 }),                  // tokenVersion
        async (userId, username, jwtRole, tokenVersion) => {
          // Pick a DB role that is guaranteed to differ from the JWT role
          const otherRoles = ROLES.filter(r => r !== jwtRole);
          const dbRole = otherRoles[userId % otherRoles.length];

          const user: UserForToken = {
            id: String(userId),
            username,
            role: jwtRole,
            tokenVersion,
          };
          const token = generateToken(user);

          (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
            tokenVersion,
            stableName: null,
            role: dbRole,
          });

          const { req, res, next, wasNextCalled } = createMockReqResNext(token);
          await authenticateToken(req, res, next);

          expect(wasNextCalled()).toBe(true);
          expect(req.user).toBeDefined();
          expect(req.user!.role).toBe(dbRole);
          expect(req.user!.role).not.toBe(jwtRole);
        }
      ),
      { numRuns: 100 }
    );
  });
});
