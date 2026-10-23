/**
 * Shared thresholds of the admin analytics and dashboard services.
 *
 * Each value used to be declared in more than one service; keeping a single
 * declaration means the dashboard's "Needs attention" count, the economy
 * overview and the At-Risk list cannot disagree about who is at risk.
 */

/** Credits below which a stable is considered at risk of bankruptcy. */
export const BANKRUPTCY_RISK_THRESHOLD = 10_000;

/** A login older than this makes a human player "inactive" on the dashboard. */
export const INACTIVE_PLAYER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/** Window of the "active" and "new" player counts on the dashboard. */
export const PLAYER_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A settlement older than this, while the scheduler is active, means the
 * daily cycle did not run. Settlement is daily, so 26 h allows a 2 h margin.
 */
export const SETTLEMENT_OVERDUE_AFTER_MS = 26 * 60 * 60 * 1000;

/**
 * A match still `scheduled` this long after its `scheduledFor` time was left
 * behind by its battle-event job. The margin covers a job that is still running.
 */
export const STUCK_MATCH_GRACE_MS = 2 * 60 * 60 * 1000;
