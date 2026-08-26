/**
 * Current_Cycle window derivation — Spec #48 Requirement 2.
 *
 * @module services/dashboard/cycleWindow
 */

/** The edges of one Current_Cycle window, plus the next settlement boundary. */
export interface CurrentCycleWindow {
  /** Most recent midnight UTC settlement boundary, inclusive. */
  start: Date;
  /** The request timestamp, exclusive. */
  end: Date;
  /** The next midnight UTC settlement boundary. */
  nextBoundary: Date;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Both window edges, captured once per request so that every figure on the
 * Overview_Row covers the identical interval (Requirement 2 criterion 1).
 *
 * The window is the half-open interval `[most recent midnight UTC, now)`.
 *
 * Deliberately NOT derived from the request timestamp minus a fixed duration
 * (criterion 6): a rolling window makes figures shrink between refreshes as events
 * age out of it, and a module whose job is to show momentum cannot have its numbers
 * go down because time passed.
 *
 * Deliberately NOT derived from `lastLoginAt` (criterion 7): that column is written
 * at login as a fire-and-forget update, so by the time the Dashboard's requests land
 * it is already approximately "now" and the window is empty. The tier-changes
 * endpoint in `routes/leagues.ts` already uses a fixed window specifically to dodge
 * that race.
 */
export function currentCycleWindow(now: Date): CurrentCycleWindow {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const nextBoundary = new Date(start.getTime() + ONE_DAY_MS);

  return { start, end: now, nextBoundary };
}
