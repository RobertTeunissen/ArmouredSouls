/**
 * Backend pg pool size (`DB_POOL_MAX`).
 *
 * A leaf module, separate from `lib/prisma.ts`, so code that sizes its own
 * parallelism from the pool (the Automaton Turn_Step) can read it while unit
 * tests mock `lib/prisma` with only a default export.
 */

/** Pool size when `DB_POOL_MAX` is unset or invalid (see `lib/prisma.ts`). */
export const DEFAULT_DB_POOL_MAX = 15;

/**
 * Parse `DB_POOL_MAX`. A value that is not an integer of at least 1 falls
 * back to DEFAULT_DB_POOL_MAX, so `pg.Pool` never receives NaN.
 */
export function resolveDbPoolMax(raw: string | undefined = process.env.DB_POOL_MAX): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DB_POOL_MAX;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_DB_POOL_MAX;
  return parsed;
}
