/**
 * Security Monitor — Singleton
 *
 * In-memory sliding window monitor that tracks anomalous patterns and writes
 * to the dedicated security logger. Keeps a circular buffer of the last 500
 * events for admin API access.
 *
 * Sliding windows use in-memory Maps — acceptable for single-server deployment.
 *
 * @module services/security/securityMonitor
 * @see Requirements 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { securityLogger, SecuritySeverity, SecurityEvent } from './securityLogger';

/** Thresholds */
const RAPID_SPENDING_AMOUNT = 3_000_000;
const RAPID_SPENDING_WINDOW_MS = 5 * 60 * 1000;       // 5 minutes
const CONFLICT_THRESHOLD = 10;
const CONFLICT_WINDOW_MS = 1 * 60 * 1000;             // 1 minute
const ROBOT_CREATION_THRESHOLD = 3;
const ROBOT_CREATION_WINDOW_MS = 10 * 60 * 1000;      // 10 minutes
const RATE_LIMIT_THRESHOLD = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;          // 1 hour
const MAX_RECENT_EVENTS = 500;

interface SpendingEntry {
  amount: number;
  time: number;
}

class SecurityMonitor {
  private spendingWindows = new Map<number, SpendingEntry[]>();
  private conflictWindows = new Map<number, number[]>();
  private robotCreationWindows = new Map<number, number[]>();
  private rateLimitViolations = new Map<number, number[]>();

  /** Circular buffer of recent security events for admin API access */
  private recentEvents: SecurityEvent[] = [];

  /** Cache of userId → stableName for enriching events without DB calls on every event */
  private stableNameCache = new Map<number, string>();

  // ── helpers ──────────────────────────────────────────────────────────

  /** Set the stable name for a user (called by middleware/routes that have user context). */
  setStableName(userId: number, stableName: string): void {
    this.stableNameCache.set(userId, stableName);
  }

  /** Get cached stable name for a user, if available. */
  private getStableName(userId?: number): string | undefined {
    if (userId === undefined) return undefined;
    return this.stableNameCache.get(userId);
  }

  /** Prune timestamps older than `windowMs` from an array, mutating in place. */
  private pruneWindow(timestamps: number[], windowMs: number, now: number): void {
    const cutoff = now - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  /** Push an event into the circular buffer and write to the security log. */
  private recordEvent(event: SecurityEvent): void {
    // Auto-enrich with stableName if available and not already set
    if (event.userId !== undefined && !event.stableName) {
      event.stableName = this.getStableName(event.userId);
    }

    if (this.recentEvents.length >= MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }
    this.recentEvents.push(event);

    // Fire-and-forget log write — never block the request pipeline
    try {
      securityLogger.log(event.severity, event.eventType, {
        ...event,
      });
    } catch {
      // Swallow — logging failure must not affect the request
    }
  }

  // ── public API ───────────────────────────────────────────────────────

  /**
   * Track a spending event for rapid-spending detection (Req 7.1).
   * If cumulative spending exceeds 3M in a 5-minute window, emit a critical alert.
   */
  trackSpending(userId: number, amount: number, context?: { sourceIp?: string; endpoint?: string }): void {
    const now = Date.now();
    if (!this.spendingWindows.has(userId)) {
      this.spendingWindows.set(userId, []);
    }
    const entries = this.spendingWindows.get(userId)!;

    // Prune old entries
    const cutoff = now - RAPID_SPENDING_WINDOW_MS;
    while (entries.length > 0 && entries[0].time < cutoff) {
      entries.shift();
    }

    entries.push({ amount, time: now });

    const total = entries.reduce((sum, e) => sum + e.amount, 0);

    // Always log spending as info
    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'spending',
      userId,
      sourceIp: context?.sourceIp,
      endpoint: context?.endpoint,
      details: { amount, windowTotal: total },
      timestamp: new Date(now).toISOString(),
    });

    if (total > RAPID_SPENDING_AMOUNT) {
      this.recordEvent({
        severity: SecuritySeverity.CRITICAL,
        eventType: 'rapid_spending',
        userId,
        sourceIp: context?.sourceIp,
        endpoint: context?.endpoint,
        details: {
          totalAmount: total,
          windowMs: RAPID_SPENDING_WINDOW_MS,
          transactions: entries.map(e => ({ amount: e.amount, time: new Date(e.time).toISOString() })),
        },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  /**
   * Track a 409 conflict response for race-condition exploit detection (Req 7.2).
   * If >10 conflicts in 1 minute, emit a warning alert.
   */
  trackConflict(userId: number, context?: { sourceIp?: string; endpoint?: string }): void {
    const now = Date.now();
    if (!this.conflictWindows.has(userId)) {
      this.conflictWindows.set(userId, []);
    }
    const timestamps = this.conflictWindows.get(userId)!;
    this.pruneWindow(timestamps, CONFLICT_WINDOW_MS, now);
    timestamps.push(now);

    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'conflict',
      userId,
      sourceIp: context?.sourceIp,
      endpoint: context?.endpoint,
      details: { windowCount: timestamps.length },
      timestamp: new Date(now).toISOString(),
    });

    if (timestamps.length > CONFLICT_THRESHOLD) {
      this.recordEvent({
        severity: SecuritySeverity.WARNING,
        eventType: 'race_condition_attempt',
        userId,
        sourceIp: context?.sourceIp,
        endpoint: context?.endpoint,
        details: {
          conflictCount: timestamps.length,
          windowMs: CONFLICT_WINDOW_MS,
        },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  /**
   * Log a failed authorization attempt (Req 7.3).
   */
  logAuthorizationFailure(userId: number, resourceType: string, resourceId: number, context?: { sourceIp?: string; endpoint?: string }): void {
    this.recordEvent({
      severity: SecuritySeverity.WARNING,
      eventType: 'authorization_failure',
      userId,
      sourceIp: context?.sourceIp,
      endpoint: context?.endpoint,
      details: { resourceType, resourceId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log a validation failure (Req 7.4).
   */
  logValidationFailure(endpoint: string, violationType: string, sourceIp: string): void {
    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'validation_failure',
      endpoint,
      sourceIp,
      details: { violationType, endpoint, sourceIp },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track robot creation for automation detection (Req 7.5).
   * If >3 creations in 10 minutes, emit a warning alert.
   */
  trackRobotCreation(userId: number, context?: { sourceIp?: string; endpoint?: string }): void {
    const now = Date.now();
    if (!this.robotCreationWindows.has(userId)) {
      this.robotCreationWindows.set(userId, []);
    }
    const timestamps = this.robotCreationWindows.get(userId)!;
    this.pruneWindow(timestamps, ROBOT_CREATION_WINDOW_MS, now);
    timestamps.push(now);

    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'robot_creation',
      userId,
      sourceIp: context?.sourceIp,
      endpoint: context?.endpoint,
      details: { windowCount: timestamps.length },
      timestamp: new Date(now).toISOString(),
    });

    if (timestamps.length > ROBOT_CREATION_THRESHOLD) {
      this.recordEvent({
        severity: SecuritySeverity.WARNING,
        eventType: 'automated_robot_creation',
        userId,
        sourceIp: context?.sourceIp,
        endpoint: context?.endpoint,
        details: {
          creationCount: timestamps.length,
          windowMs: ROBOT_CREATION_WINDOW_MS,
        },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  /**
   * Log an admin access event (informational).
   */
  logAdminAccess(userId: number, context: { sourceIp?: string; endpoint: string; method: string }): void {
    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'admin_access',
      userId,
      sourceIp: context.sourceIp,
      endpoint: context.endpoint,
      details: { method: context.method },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track rate limit violations per user (Req 6.6).
   * If >5 violations in 1 hour, emit a warning alert.
   */
  trackRateLimitViolation(userId: number, endpoint: string): void {
    const now = Date.now();
    if (!this.rateLimitViolations.has(userId)) {
      this.rateLimitViolations.set(userId, []);
    }
    const timestamps = this.rateLimitViolations.get(userId)!;
    this.pruneWindow(timestamps, RATE_LIMIT_WINDOW_MS, now);
    timestamps.push(now);

    this.recordEvent({
      severity: SecuritySeverity.INFO,
      eventType: 'rate_limit_violation',
      userId,
      endpoint,
      details: { endpoint, windowCount: timestamps.length },
      timestamp: new Date(now).toISOString(),
    });

    if (timestamps.length > RATE_LIMIT_THRESHOLD) {
      this.recordEvent({
        severity: SecuritySeverity.WARNING,
        eventType: 'rate_limit_escalation',
        userId,
        endpoint,
        details: {
          violationCount: timestamps.length,
          windowMs: RATE_LIMIT_WINDOW_MS,
          endpoint,
        },
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  // ── admin API ────────────────────────────────────────────────────────

  /**
   * Get recent security events for admin dashboard.
   * Supports filtering by severity, eventType, userId, and time range.
   * Returns newest events first.
   */
  getRecentEvents(filters?: {
    severity?: SecuritySeverity;
    eventType?: string;
    userId?: number;
    since?: Date;
    limit?: number;
  }): SecurityEvent[] {
    let events = [...this.recentEvents];

    if (filters?.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }
    if (filters?.eventType) {
      events = events.filter(e => e.eventType === filters.eventType);
    }
    if (filters?.userId !== undefined) {
      events = events.filter(e => e.userId === filters.userId);
    }
    if (filters?.since) {
      const sinceMs = filters.since.getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
    }

    // Newest first
    events.reverse();

    if (filters?.limit && filters.limit > 0) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  /**
   * Get a summary of current security state for admin dashboard.
   */
  getSummary(): {
    totalEvents: number;
    bySeverity: Record<SecuritySeverity, number>;
    activeAlerts: number;
    flaggedUserIds: number[];
  } {
    const bySeverity: Record<SecuritySeverity, number> = {
      [SecuritySeverity.INFO]: 0,
      [SecuritySeverity.WARNING]: 0,
      [SecuritySeverity.CRITICAL]: 0,
    };

    const flaggedUserSet = new Set<number>();

    for (const event of this.recentEvents) {
      bySeverity[event.severity]++;
      if (
        (event.severity === SecuritySeverity.WARNING || event.severity === SecuritySeverity.CRITICAL) &&
        event.userId !== undefined
      ) {
        flaggedUserSet.add(event.userId);
      }
    }

    return {
      totalEvents: this.recentEvents.length,
      bySeverity,
      activeAlerts: bySeverity[SecuritySeverity.WARNING] + bySeverity[SecuritySeverity.CRITICAL],
      flaggedUserIds: Array.from(flaggedUserSet),
    };
  }

  /**
   * Reset all internal state. Useful for testing.
   */
  _reset(): void {
    this.spendingWindows.clear();
    this.conflictWindows.clear();
    this.robotCreationWindows.clear();
    this.rateLimitViolations.clear();
    this.stableNameCache.clear();
    this.recentEvents = [];
  }
}

export const securityMonitor = new SecurityMonitor();
