/**
 * Minimum sample sizes for Hall of Records rankings. The backend filters on
 * them and the frontend states them in each record's scope line.
 */

/** Highest Win Rate only ranks robots with at least this many win/loss-mode battles. */
export const WIN_RATE_MIN_BATTLES = 50;

/**
 * Highest Avg Zone Score only ranks robots with at least this many KotH
 * matches, so one lucky match cannot top the list.
 */
export const KOTH_AVG_ZONE_SCORE_MIN_MATCHES = 10;
