/**
 * Feature: security-audit-guardrails, Properties 14–18: Security Monitor
 *
 * **Validates: Requirements 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 *
 * Tests the SecurityMonitor singleton in isolation — no HTTP, no database.
 * Each property verifies that the in-memory sliding window logic correctly
 * detects anomalous patterns and emits the right severity events.
 */
import fc from 'fast-check';

// Mock the security logger to prevent file I/O during tests
jest.mock('../src/services/security/securityLogger', () => ({
  SecuritySeverity: {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
  },
  securityLogger: {
    log: jest.fn(),
  },
}));

// Mock prisma (transitive dependency)
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import { securityMonitor } from '../src/services/security/securityMonitor';
import { SecuritySeverity } from '../src/services/security/securityLogger';

beforeEach(() => {
  securityMonitor._reset();
});

describe('Feature: security-audit-guardrails, Property 14: Rapid spending alert threshold', () => {
  it('emits a critical alert when cumulative spending exceeds 3M in a 5-minute window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.array(
          fc.integer({ min: 100000, max: 1000000 }),
          { minLength: 4, maxLength: 10 }
        ),  // spending amounts that will sum > 3M
        (userId, amounts) => {
          securityMonitor._reset();

          const total = amounts.reduce((sum, a) => sum + a, 0);
          // Only test cases where total exceeds 3M threshold
          fc.pre(total > 3_000_000);

          for (const amount of amounts) {
            securityMonitor.trackSpending(userId, amount);
          }

          const events = securityMonitor.getRecentEvents({
            eventType: 'rapid_spending',
          });

          // Must have at least one critical rapid_spending event
          expect(events.length).toBeGreaterThanOrEqual(1);
          expect(events[0].severity).toBe(SecuritySeverity.CRITICAL);
          expect(events[0].userId).toBe(userId);
          expect(events[0].details.totalAmount).toBeGreaterThan(3_000_000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit a critical alert when spending stays below 3M', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.array(
          fc.integer({ min: 1, max: 100000 }),
          { minLength: 1, maxLength: 5 }
        ),  // small amounts
        (userId, amounts) => {
          securityMonitor._reset();

          const total = amounts.reduce((sum, a) => sum + a, 0);
          fc.pre(total <= 3_000_000);

          for (const amount of amounts) {
            securityMonitor.trackSpending(userId, amount);
          }

          const criticalEvents = securityMonitor.getRecentEvents({
            eventType: 'rapid_spending',
          });

          expect(criticalEvents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: security-audit-guardrails, Property 15: Race condition conflict detection', () => {
  it('emits a warning alert when >10 conflicts occur in 1 minute', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 11, max: 30 }),     // conflictCount (> 10)
        (userId, conflictCount) => {
          securityMonitor._reset();

          for (let i = 0; i < conflictCount; i++) {
            securityMonitor.trackConflict(userId);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'race_condition_attempt',
          });

          // Must have at least one warning event
          expect(warningEvents.length).toBeGreaterThanOrEqual(1);
          expect(warningEvents[0].severity).toBe(SecuritySeverity.WARNING);
          expect(warningEvents[0].userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit a warning when conflicts stay at or below 10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 1, max: 10 }),      // conflictCount (<= 10)
        (userId, conflictCount) => {
          securityMonitor._reset();

          for (let i = 0; i < conflictCount; i++) {
            securityMonitor.trackConflict(userId);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'race_condition_attempt',
          });

          expect(warningEvents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: security-audit-guardrails, Property 16: Security event logging completeness', () => {
  it('authorization failure logs contain userId, resourceType, and resourceId', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.constantFrom('robot', 'weapon', 'facility'),  // resourceType
        fc.integer({ min: 1, max: 100000 }),  // resourceId
        (userId, resourceType, resourceId) => {
          securityMonitor._reset();

          securityMonitor.logAuthorizationFailure(userId, resourceType, resourceId);

          const events = securityMonitor.getRecentEvents({
            eventType: 'authorization_failure',
          });

          expect(events.length).toBe(1);
          expect(events[0].userId).toBe(userId);
          expect(events[0].details.resourceType).toBe(resourceType);
          expect(events[0].details.resourceId).toBe(resourceId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation failure logs contain endpoint, violationType, and sourceIp', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\/api\/[a-z]+\/[a-z]+$/),  // endpoint
        fc.constantFrom('invalid_body', 'invalid_params', 'invalid_query'),  // violationType
        fc.stringMatching(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/),  // sourceIp
        (endpoint, violationType, sourceIp) => {
          securityMonitor._reset();

          securityMonitor.logValidationFailure(endpoint, violationType, sourceIp);

          const events = securityMonitor.getRecentEvents({
            eventType: 'validation_failure',
          });

          expect(events.length).toBe(1);
          expect(events[0].endpoint).toBe(endpoint);
          expect(events[0].details.violationType).toBe(violationType);
          expect(events[0].details.sourceIp).toBe(sourceIp);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: security-audit-guardrails, Property 17: Robot creation automation detection', () => {
  it('emits a warning alert when >3 robots created in 10 minutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 4, max: 15 }),      // creationCount (> 3)
        (userId, creationCount) => {
          securityMonitor._reset();

          for (let i = 0; i < creationCount; i++) {
            securityMonitor.trackRobotCreation(userId);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'automated_robot_creation',
          });

          // Must have at least one warning event
          expect(warningEvents.length).toBeGreaterThanOrEqual(1);
          expect(warningEvents[0].severity).toBe(SecuritySeverity.WARNING);
          expect(warningEvents[0].userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit a warning when creations stay at or below 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 1, max: 3 }),       // creationCount (<= 3)
        (userId, creationCount) => {
          securityMonitor._reset();

          for (let i = 0; i < creationCount; i++) {
            securityMonitor.trackRobotCreation(userId);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'automated_robot_creation',
          });

          expect(warningEvents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: security-audit-guardrails, Property 18: Rate limit violation escalation', () => {
  it('emits a warning alert when >5 rate limit violations in 1 hour', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 6, max: 20 }),      // violationCount (> 5)
        fc.stringMatching(/^\/api\/[a-z]+$/), // endpoint
        (userId, violationCount, endpoint) => {
          securityMonitor._reset();

          for (let i = 0; i < violationCount; i++) {
            securityMonitor.trackRateLimitViolation(userId, endpoint);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'rate_limit_escalation',
          });

          // Must have at least one warning event
          expect(warningEvents.length).toBeGreaterThanOrEqual(1);
          expect(warningEvents[0].severity).toBe(SecuritySeverity.WARNING);
          expect(warningEvents[0].userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit a warning when violations stay at or below 5', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),  // userId
        fc.integer({ min: 1, max: 5 }),       // violationCount (<= 5)
        fc.stringMatching(/^\/api\/[a-z]+$/), // endpoint
        (userId, violationCount, endpoint) => {
          securityMonitor._reset();

          for (let i = 0; i < violationCount; i++) {
            securityMonitor.trackRateLimitViolation(userId, endpoint);
          }

          const warningEvents = securityMonitor.getRecentEvents({
            eventType: 'rate_limit_escalation',
          });

          expect(warningEvents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
