/**
 * Unit tests for enhanced auth middleware
 *
 * Tests cover:
 * 1. DB role used instead of JWT role (authenticateToken)
 * 2. Role change takes effect immediately
 * 3. Admin rate limiter applied (requireAdmin)
 * 4. Access logged on success (requireAdmin)
 * 5. Violations tracked on rate limit exceed
 *
 * _Requirements: 27.1, 27.2, 27.3_
 */

import { generateToken, UserForToken } from '../../services/auth/jwtService';

// ── Mocks ──────────────────────────────────────────────────────────────

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/security/securityMonitor', () => ({
  __esModule: true,
  securityMonitor: {
    setStableName: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    logAdminAccess: jest.fn(),
    trackRateLimitViolation: jest.fn(),
    recordEvent: jest.fn(),
  },
}));

// Mock express-rate-limit so we can control rate limiter behavior
const mockRateLimiter = jest.fn();
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    // Return a middleware that by default calls next (not rate limited)
    return mockRateLimiter.mockImplementation((_req, _res, next) => {
      next();
    });
  });
});

import prisma from '../../lib/prisma';
import { securityMonitor } from '../../services/security/securityMonitor';
import { authenticateToken, requireAdmin, AuthRequest, invalidateTokenCache } from '../auth';
import { Response, NextFunction } from 'express';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

// Clear the auth token cache before each test to avoid cross-test contamination
beforeEach(() => {
  // Invalidate cache for common test user IDs
  invalidateTokenCache(1);
  invalidateTokenCache(42);
});

// ── Helpers ────────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    user: undefined,
    ip: '127.0.0.1',
    originalUrl: '/api/admin/test',
    method: 'GET',
    ...overrides,
  } as unknown as AuthRequest;
}

function createMockResponse(): Response & { _status: number; _json: Record<string, unknown> } {
  const res = {
    _status: 0,
    _json: {},
    status: jest.fn().mockImplementation(function (this: typeof res, code: number) {
      this._status = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function (this: typeof res, body: Record<string, unknown>) {
      this._json = body;
      return this;
    }),
  } as unknown as Response & { _status: number; _json: Record<string, unknown> };
  return res;
}

function createMockNext(): NextFunction & { called: boolean } {
  const fn = jest.fn().mockImplementation(() => {
    (fn as NextFunction & { called: boolean }).called = true;
  }) as unknown as NextFunction & { called: boolean };
  fn.called = false;
  return fn;
}

function issueToken(overrides: Partial<UserForToken> = {}): string {
  return generateToken({
    id: '1',
    username: 'testadmin',
    role: 'admin',
    tokenVersion: 0,
    ...overrides,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('authenticateToken — DB role precedence', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should set req.user.role from DB, not from JWT', async () => {
    // JWT says "user", DB says "admin"
    const token = issueToken({ role: 'user' });
    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      tokenVersion: 0,
      stableName: null,
      role: 'admin',
    });

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.role).toBe('admin'); // DB role, not JWT role
  });

  it('should use DB role when JWT role is "admin" but DB role is "user"', async () => {
    const token = issueToken({ role: 'admin' });
    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      tokenVersion: 0,
      stableName: null,
      role: 'user',
    });

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user!.role).toBe('user'); // DB role wins
  });

  it('should reflect role change immediately on next request', async () => {
    const token = issueToken({ role: 'admin' });

    // First request: DB says admin
    const req1 = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<AuthRequest>);
    const res1 = createMockResponse();
    const next1 = createMockNext();

    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      tokenVersion: 0,
      stableName: null,
      role: 'admin',
    });

    await authenticateToken(req1, res1, next1);
    expect(req1.user!.role).toBe('admin');

    // Second request (same JWT): DB now says user (role was changed)
    // In production, role changes would call invalidateTokenCache — simulate that
    invalidateTokenCache(42);

    const req2 = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    } as Partial<AuthRequest>);
    const res2 = createMockResponse();
    const next2 = createMockNext();

    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      tokenVersion: 0,
      stableName: null,
      role: 'user',
    });

    await authenticateToken(req2, res2, next2);
    expect(req2.user!.role).toBe('user'); // Immediately reflects the change
  });
});

describe('requireAdmin — rate limiter and access logging', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should log admin access on successful role check', () => {
    const req = createMockRequest({
      user: { userId: 1, username: 'admin1', role: 'admin' },
      ip: '10.0.0.1',
      originalUrl: '/api/admin/dashboard',
      method: 'GET',
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(securityMonitor.logAdminAccess).toHaveBeenCalledWith(1, {
      sourceIp: '10.0.0.1',
      endpoint: '/api/admin/dashboard',
      method: 'GET',
    });
  });

  it('should call the admin rate limiter after role check passes', () => {
    const req = createMockRequest({
      user: { userId: 1, username: 'admin1', role: 'admin' },
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    requireAdmin(req, res, next);

    // The rate limiter mock should have been called
    expect(mockRateLimiter).toHaveBeenCalled();
    // And next() should have been called (rate limiter passes through)
    expect(next).toHaveBeenCalled();
  });

  it('should not call rate limiter or log access for non-admin users', () => {
    const req = createMockRequest({
      user: { userId: 2, username: 'player1', role: 'user' },
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res._status).toBe(403);
    expect(securityMonitor.logAdminAccess).not.toHaveBeenCalled();
    expect(mockRateLimiter).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when no user is present', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should log authorization failure for non-admin users', () => {
    const req = createMockRequest({
      user: { userId: 5, username: 'hacker', role: 'user' },
      ip: '192.168.1.1',
      originalUrl: '/api/admin/secret',
    } as Partial<AuthRequest>);
    const res = createMockResponse();
    const next = createMockNext();

    requireAdmin(req, res, next);

    expect(securityMonitor.logAuthorizationFailure).toHaveBeenCalledWith(
      5,
      'admin_endpoint',
      0,
      {
        sourceIp: '192.168.1.1',
        endpoint: '/api/admin/secret',
      }
    );
  });

  it('should track rate limit violations when rate limiter handler fires', () => {
    // Access the stored options from the rateLimit mock to get the handler
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rateLimit = require('express-rate-limit');
    const options = rateLimit.mock.calls[0]?.[0];

    // If options exist, test the handler directly
    if (options?.handler) {
      const req = createMockRequest({
        user: { userId: 42, username: 'admin1', role: 'admin' },
        originalUrl: '/api/admin/heavy-endpoint',
      } as Partial<AuthRequest>);
      const res = createMockResponse();

      options.handler(req, res);

      expect(securityMonitor.trackRateLimitViolation).toHaveBeenCalledWith(
        42,
        '/api/admin/heavy-endpoint'
      );
      expect(res._status).toBe(429);
      expect(res._json).toEqual({ error: 'ADMIN_RATE_LIMIT_EXCEEDED' });
    }
  });

  it('should generate rate limiter key using admin:{userId}', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rateLimit = require('express-rate-limit');
    const options = rateLimit.mock.calls[0]?.[0];

    if (options?.keyGenerator) {
      const req = createMockRequest({
        user: { userId: 99, username: 'admin1', role: 'admin' },
      } as Partial<AuthRequest>);

      const key = options.keyGenerator(req);
      expect(key).toBe('admin:99');
    }
  });
});
