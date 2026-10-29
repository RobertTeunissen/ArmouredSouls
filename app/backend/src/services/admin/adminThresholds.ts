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

/**
 * League Health judges promotion and demotion flow over a mode's last this-many
 * rebalances (`league_history`). With fewer, a tier's flow is not judged.
 */
export const LEAGUE_HISTORY_WINDOW = 5;

/**
 * League Health flags "Low promotion" (and notes "few demotions") when, on
 * average over the history window, fewer than this share of a tier's current
 * places were filled.
 */
export const LEAGUE_LOW_MOVEMENT_SHARE = 0.25;

/**
 * League Health "This season": a promotion "bounces back" when the same entity
 * is demoted back across the same boundary within this many cycles.
 */
export const LEAGUE_BOUNCE_WINDOW_CYCLES = 10;

/** Bounce-back share above which a tier boundary gets a note. */
export const LEAGUE_BOUNCE_NOTE_SHARE = 0.2;

/** Judged promotions a boundary needs before its bounce-back share gets a note. */
export const LEAGUE_BOUNCE_MIN_SAMPLE = 20;

/**
 * League Health notes a tier whose unsubscribed standings rows reach this share.
 * Those rows keep their instance seat and count toward the 10% zone sizes.
 */
export const LEAGUE_UNSUBSCRIBED_NOTICE_SHARE = 0.05;
