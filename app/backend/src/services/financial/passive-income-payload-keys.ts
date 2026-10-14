/**
 * Read-both / write-new resolver for the `passive_income` audit payload's
 * informational battle count.
 *
 * The settlement `passive_income` domain event (`audit_logs.payload`) records
 * the stable's summed `robots.total_battles` at settlement. That counter covers
 * the win/loss modes only (league 1v1, tournaments, tag team, 2v2/3v3 League);
 * KotH and Grand Melee never touch it. The key used to be `totalBattles`, which
 * read as "every battle played" once every mode counted as a battle, so it is
 * now written as `winLossModeBattles`. The value is unchanged: the raw counter.
 *
 *   `audit_logs.payload.totalBattles` -> `winLossModeBattles`
 *
 * There is no data migration: the key lives inside a `Json` column, and rows
 * written before the rename keep `totalBattles`. Every reader goes through
 * `readPassiveIncomeWinLossModeBattles`, which reads the new key first and falls
 * back to the old one. The value is informational only; no income, cost or
 * snapshot figure is derived from it.
 *
 * REMOVABLE AT THE NEXT Season_Rollover: a rollover purges `audit_logs`, so no
 * row with the old key survives it and the fallback becomes dead code.
 */

/** Renamed key. Written on every new `passive_income` row; read first. */
export const PASSIVE_INCOME_WIN_LOSS_BATTLES_KEY = 'winLossModeBattles' as const;

/** Pre-rename key, retained only for the read fallback. */
const LEGACY_PASSIVE_INCOME_BATTLES_KEY = 'totalBattles';

/**
 * The stable's win/loss-mode battle count recorded on a `passive_income`
 * payload. Prefers the renamed key and never sums the two. Null when neither
 * key holds a finite number, so a malformed row is skipped rather than read as 0.
 */
export function readPassiveIncomeWinLossModeBattles(
  payload: Record<string, unknown> | null | undefined,
): number | null {
  if (payload === null || payload === undefined) return null;
  for (const key of [PASSIVE_INCOME_WIN_LOSS_BATTLES_KEY, LEGACY_PASSIVE_INCOME_BATTLES_KEY]) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}
