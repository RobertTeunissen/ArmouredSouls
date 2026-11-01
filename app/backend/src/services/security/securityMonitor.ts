/**
 * Security Monitor — Singleton
 *
 * Detects security signals and records them. In-memory sliding windows decide
 * when a burst fires (acceptable for the single-process deployment); every
 * signal is written to `security_events` (the admin Security page reads it,
 * and it survives deploys) and to the dedicated security log.
 *
 * Signals: failed logins, rate-limit hits, ownership violations, race-condition
 * bursts, robot-creation bursts and malformed requests without a logged-in
 * user. Admin page views and routine purchases are deliberately not recorded:
 * they made up almost every event of the old in-memory list.
 *
 * @module services/security/securityMonitor
 * @see docs/architecture/PRD_SECURITY.md §Logging
 */

import { securityLogger, SecuritySeverity, SecurityEvent } from './securityLogger';
import { persistSecuritySignal } from './securityEventStore';
import type { FailedLoginReason, SecurityEventDetails, SecuritySignal } from '../../types';

/** Thresholds */
const CONFLICT_THRESHOLD = 10;
const CONFLICT_WINDOW_MS = 1 * 60 * 1000;             // 1 minute
const ROBOT_CREATION_THRESHOLD = 3;
const ROBOT_CREATION_WINDOW_MS = 10 * 60 * 1000;      // 10 minutes

interface RequestContext {
  sourceIp?: string;
  endpoint?: string;
}

class SecurityMonitor {
  private conflictWindows = new Map<number, number[]>();
  private robotCreationWindows = new Map<number, number[]>();

  /** Cache of userId → stableName for enriching log lines without DB calls on every event */
  private stableNameCache = new Map<number, string>();
  private static readonly MAX_STABLE_NAME_CACHE_SIZE = 1000;

  // ── helpers ──────────────────────────────────────────────────────────

  /** Set the stable name for a user (called by middleware/routes that have user context). */
  setStableName(userId: number, stableName: string): void {
    // Evict oldest entry if cache is full (LRU-style via Map insertion order)
    if (this.stableNameCache.size >= SecurityMonitor.MAX_STABLE_NAME_CACHE_SIZE && !this.stableNameCache.has(userId)) {
      const firstKey = this.stableNameCache.keys().next().value;
      if (firstKey !== undefined) this.stableNameCache.delete(firstKey);
    }
    this.stableNameCache.set(userId, stableName);
  }

  /** Prune timestamps older than `windowMs` from an array, mutating in place. */
  private pruneWindow(timestamps: number[], windowMs: number, now: number): void {
    const cutoff = now - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  /** Append to a per-user sliding window and return its size after pruning. */
  private slide(windows: Map<number, number[]>, userId: number, windowMs: number): number {
    const now = Date.now();
    const timestamps = windows.get(userId) ?? [];
    this.pruneWindow(timestamps, windowMs, now);
    timestamps.push(now);
    windows.set(userId, timestamps);
    return timestamps.length;
  }

  /** Write a line to the dedicated security log. Never throws. */
  private log(event: Omit<SecurityEvent, 'timestamp'>): void {
    const stableName = event.userId !== undefined ? this.stableNameCache.get(event.userId) : undefined;
    try {
      securityLogger.log(event.severity, event.eventType, {
        ...event,
        ...(stableName ? { stableName } : {}),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Swallow — logging failure must not affect the request
    }
  }

  /** Record a signal: database row (admin page) plus a security log line. */
  private signal(signal: SecuritySignal, userId: number | undefined, context: RequestContext, details: SecurityEventDetails = {}): void {
    persistSecuritySignal({ signal, userId, sourceIp: context.sourceIp, endpoint: context.endpoint, details });
    this.log({
      severity: SecuritySeverity.WARNING,
      eventType: signal,
      userId,
      sourceIp: context.sourceIp,
      endpoint: context.endpoint,
      details: details as Record<string, unknown>,
    });
  }

  // ── public API ───────────────────────────────────────────────────────

  /**
   * A login attempt failed. `targetUserId` is the account the name matched, if
   * any; the submitted name and password are never recorded.
   */
  logFailedLogin(reason: FailedLoginReason, targetUserId: number | undefined, context: RequestContext): void {
    this.signal('failed_login', targetUserId, context, { reason });
  }

  /**
   * Track a 409 conflict response for race-condition exploit detection (Req 7.2).
   * The 11th conflict within 1 minute records one race-condition burst; the
   * window has to drain below the threshold before another one is recorded.
   */
  trackConflict(userId: number, context: RequestContext = {}): void {
    const count = this.slide(this.conflictWindows, userId, CONFLICT_WINDOW_MS);
    if (count === CONFLICT_THRESHOLD + 1) {
      this.signal('race_condition_burst', userId, context, { count, windowMs: CONFLICT_WINDOW_MS });
    }
  }

  /**
   * Log a failed authorization attempt (Req 7.3): another stable's resource,
   * or a non-admin on an admin endpoint.
   */
  logAuthorizationFailure(userId: number, resourceType: string, resourceId: number, context: RequestContext = {}): void {
    this.signal('ownership_violation', userId, context, { resourceType, resourceId });
  }

  /**
   * Log a schema validation failure (Req 7.4). Only requests without a
   * logged-in user become a signal: a player's own malformed request is
   * almost always a UI bug, not an attack. The rest go to the security log.
   */
  logValidationFailure(endpoint: string, violationType: string, sourceIp: string, authenticated = false): void {
    if (authenticated) {
      this.log({ severity: SecuritySeverity.INFO, eventType: 'validation_failure', endpoint, sourceIp, details: { violationType } });
      return;
    }
    this.signal('malformed_request', undefined, { sourceIp, endpoint }, { violationType });
  }

  /**
   * Track robot creation for automation detection (Req 7.5).
   * The 4th creation within 10 minutes records one robot-creation burst.
   */
  trackRobotCreation(userId: number, context: RequestContext = {}): void {
    const count = this.slide(this.robotCreationWindows, userId, ROBOT_CREATION_WINDOW_MS);
    if (count === ROBOT_CREATION_THRESHOLD + 1) {
      this.signal('robot_creation_burst', userId, context, { count, windowMs: ROBOT_CREATION_WINDOW_MS });
    }
  }

  /** A per-player rate limiter refused a request (Req 6.6). */
  trackRateLimitViolation(userId: number, endpoint: string, sourceIp?: string): void {
    this.signal('rate_limit', userId, { endpoint, sourceIp });
  }

  /** An IP-keyed limiter (login, registration, general API) refused a request before login. */
  trackAnonymousRateLimit(sourceIp: string, endpoint: string): void {
    this.signal('rate_limit', undefined, { sourceIp, endpoint });
  }

  /**
   * Log a generic security log line that is not a signal (e.g. image
   * moderation outcomes, which the audit log already records).
   */
  logSecurityEvent(severity: SecuritySeverity, eventType: string, userId: number | undefined, details: Record<string, unknown>): void {
    this.log({ severity, eventType, userId, details });
  }

  /**
   * Reset all internal state. Useful for testing.
   */
  _reset(): void {
    this.conflictWindows.clear();
    this.robotCreationWindows.clear();
    this.stableNameCache.clear();
  }
}

export const securityMonitor = new SecurityMonitor();
