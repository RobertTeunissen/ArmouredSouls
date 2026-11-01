/**
 * Feature: security-audit-guardrails, Properties 15–18: Security Monitor
 *
 * **Validates: Requirements 6.6, 7.2, 7.3, 7.4, 7.5, 7.6**
 *
 * Tests the SecurityMonitor singleton in isolation — no HTTP, no database.
 * The store is mocked, so each property checks which signals the sliding
 * windows hand to `persistSecuritySignal` (the rows of `security_events`).
 * Rapid spending (old Property 14) was removed in Nov 2026: spending a
 * player's own credits quickly is legal and only flagged normal shopping.
 */
import fc from 'fast-check';

jest.mock('../src/services/security/securityLogger', () => ({
  SecuritySeverity: { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' },
  securityLogger: { log: jest.fn() },
}));

jest.mock('../src/services/security/securityEventStore', () => ({
  persistSecuritySignal: jest.fn(),
}));

jest.mock('../src/lib/prisma', () => ({ __esModule: true, default: {} }));

import { securityMonitor } from '../src/services/security/securityMonitor';
import { persistSecuritySignal } from '../src/services/security/securityEventStore';
import type { SecuritySignal } from '../src/types';

const persisted = persistSecuritySignal as jest.Mock;

function signals(signal: SecuritySignal): Array<{ signal: SecuritySignal; userId?: number; sourceIp?: string; endpoint?: string; details?: Record<string, unknown> }> {
  return persisted.mock.calls.map((call) => call[0]).filter((input) => input.signal === signal);
}

function reset(): void {
  securityMonitor._reset();
  persisted.mockClear();
}

beforeEach(reset);

describe('Property 15: Race condition conflict detection', () => {
  it('records exactly one burst once more than 10 conflicts occur in 1 minute', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 11, max: 30 }), (userId, conflictCount) => {
        reset();
        for (let i = 0; i < conflictCount; i++) securityMonitor.trackConflict(userId);
        const bursts = signals('race_condition_burst');
        expect(bursts).toHaveLength(1);
        expect(bursts[0].userId).toBe(userId);
        expect(bursts[0].details?.count).toBe(11);
      }),
      { numRuns: 100 },
    );
  });

  it('records nothing while conflicts stay at or below 10', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 1, max: 10 }), (userId, conflictCount) => {
        reset();
        for (let i = 0; i < conflictCount; i++) securityMonitor.trackConflict(userId);
        expect(persisted).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 16: Security event logging completeness', () => {
  it('ownership violations carry userId, resourceType and resourceId', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('robot', 'weapon', 'facility', 'admin_endpoint'),
        fc.integer({ min: 0, max: 100000 }),
        (userId, resourceType, resourceId) => {
          reset();
          securityMonitor.logAuthorizationFailure(userId, resourceType, resourceId);
          const events = signals('ownership_violation');
          expect(events).toHaveLength(1);
          expect(events[0].userId).toBe(userId);
          expect(events[0].details).toEqual({ resourceType, resourceId });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a malformed request without a logged-in user carries endpoint, violationType and sourceIp', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\/api\/[a-z]+\/[a-z]+$/),
        fc.constantFrom('invalid_body', 'invalid_params', 'invalid_query'),
        fc.stringMatching(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),
        (endpoint, violationType, sourceIp) => {
          reset();
          securityMonitor.logValidationFailure(endpoint, violationType, sourceIp);
          const events = signals('malformed_request');
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({ endpoint, sourceIp, details: { violationType } });
          expect(events[0].userId).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a logged-in player\'s malformed request is not a signal', () => {
    securityMonitor.logValidationFailure('/api/robots/1', 'invalid_body', '203.0.113.5', true);
    expect(persisted).not.toHaveBeenCalled();
  });

  it('a failed login records the reason, the matched account and the IP, never the submitted values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('unknown_account', 'wrong_password', 'automaton') ,
        fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
        (reason, targetUserId) => {
          reset();
          securityMonitor.logFailedLogin(reason, targetUserId, { sourceIp: '203.0.113.9', endpoint: '/api/auth/login' });
          const events = signals('failed_login');
          expect(events).toHaveLength(1);
          expect(events[0]).toEqual({ signal: 'failed_login', userId: targetUserId, sourceIp: '203.0.113.9', endpoint: '/api/auth/login', details: { reason } });
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('Property 17: Robot creation automation detection', () => {
  it('records exactly one burst once more than 3 robots are created in 10 minutes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 4, max: 15 }), (userId, creationCount) => {
        reset();
        for (let i = 0; i < creationCount; i++) securityMonitor.trackRobotCreation(userId);
        const bursts = signals('robot_creation_burst');
        expect(bursts).toHaveLength(1);
        expect(bursts[0].userId).toBe(userId);
      }),
      { numRuns: 100 },
    );
  });

  it('records nothing while creations stay at or below 3', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 1, max: 3 }), (userId, creationCount) => {
        reset();
        for (let i = 0; i < creationCount; i++) securityMonitor.trackRobotCreation(userId);
        expect(persisted).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 18: Rate limit hits', () => {
  it('records every refused request, per player or per IP', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.stringMatching(/^\/api\/[a-z]+$/),
        (userId, hits, endpoint) => {
          reset();
          for (let i = 0; i < hits; i++) securityMonitor.trackRateLimitViolation(userId, endpoint);
          securityMonitor.trackAnonymousRateLimit('198.51.100.4', '/api/auth/login');
          const events = signals('rate_limit');
          expect(events).toHaveLength(hits + 1);
          expect(events.slice(0, hits).every((e) => e.userId === userId && e.endpoint === endpoint)).toBe(true);
          expect(events[hits]).toMatchObject({ userId: undefined, sourceIp: '198.51.100.4', endpoint: '/api/auth/login' });
        },
      ),
      { numRuns: 100 },
    );
  });
});
