import prisma from '../../lib/prisma';
import { FinancialError, FinancialErrorCode } from '../../errors';
import { getFinancialRolloutState } from './financialRollout';

/**
 * Migration feature flags for Spec #40 — Database Unification.
 *
 * Flags are persisted in the `cycle_metadata.feature_flags` JSON column
 * and control subsystems that still have a legacy fallback. The financial flag
 * is legacy-only configuration: after the durable ACC cutover state is reached,
 * required capture is controlled by `financialRollout.ts` and cannot be disabled
 * by this nullable feature flag.
 *
 * Flags are cached in-memory for 60 seconds to avoid hitting the database on
 * every request (leaderboard + legacy financial service checks per call).
 */
export interface MigrationFeatureFlags {
  /** When true, credit/debit flows write to the new financial ledger table. */
  financial_ledger_active: boolean;
  /** When true, leaderboard queries read from the materialized cache table. */
  leaderboard_cache_active: boolean;
}

/** Fail-safe defaults — all flags off means legacy behavior. */
const DEFAULT_FLAGS: MigrationFeatureFlags = {
  financial_ledger_active: false,
  leaderboard_cache_active: false,
};

// ─── In-memory cache (60s TTL) ──────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
let cachedFlags: MigrationFeatureFlags | null = null;
let cacheExpiresAt = 0;

/** Invalidate the in-memory cache (useful in tests or after setFlag). */
export function invalidateFlagCache(): void {
  cachedFlags = null;
  cacheExpiresAt = 0;
}

/**
 * Read the current migration feature flags from `cycle_metadata` (id=1).
 *
 * Results are cached in-memory for 60 seconds. On any failure (missing row,
 * malformed JSON, DB error) the function returns the default flags so the
 * system stays on the legacy path.
 */
export async function getFlags(): Promise<MigrationFeatureFlags> {
  const now = Date.now();
  if (cachedFlags && now < cacheExpiresAt) {
    return cachedFlags;
  }

  try {
    const row = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
      select: { featureFlags: true },
    });

    if (!row) {
      cachedFlags = { ...DEFAULT_FLAGS };
    } else {
      const stored = row.featureFlags as unknown as Partial<MigrationFeatureFlags>;
      cachedFlags = { ...DEFAULT_FLAGS, ...stored };
    }

    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedFlags;
  } catch {
    // Fail-safe: any read error falls back to legacy behavior.
    // Cache the default so we don't hammer the DB on persistent failures.
    cachedFlags = { ...DEFAULT_FLAGS };
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedFlags;
  }
}

/**
 * Update a single migration feature flag in `cycle_metadata` (id=1).
 *
 * Uses an upsert so the row is created if it doesn't exist yet.
 * Invalidates the in-memory cache after writing.
 *
 * @param flag  - The flag key to update.
 * @param value - The new boolean value for the flag.
 */
export async function setFlag(
  flag: keyof MigrationFeatureFlags,
  value: boolean,
): Promise<void> {
  // Required post-cutover capture is not a rollback flag. Once ACC has a
  // durable cutover cycle, disabling this legacy flag must fail rather than
  // silently restoring null/suppressed ledger enrichment.
  if (flag === 'financial_ledger_active' && !value) {
    const rollout = await getFinancialRolloutState();
    if (rollout.cutoverCycle !== null) {
      throw new FinancialError(
        FinancialErrorCode.REQUIRED_CAPTURE_UNAVAILABLE,
        'financial_ledger_active cannot disable required capture after ACC cutover',
        409,
        { cutoverCycle: rollout.cutoverCycle },
      );
    }
  }

  const current = await getFlags();
  const updated: MigrationFeatureFlags = { ...current, [flag]: value };

  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: { featureFlags: updated as unknown as Parameters<typeof prisma.cycleMetadata.update>[0]['data']['featureFlags'] },
    create: {
      id: 1,
      featureFlags: updated as unknown as Parameters<typeof prisma.cycleMetadata.create>[0]['data']['featureFlags'],
    },
  });

  // Invalidate cache so next read picks up the new value immediately
  invalidateFlagCache();
}

/**
 * Convenience helper — returns whether a single flag is enabled.
 *
 * Equivalent to `(await getFlags())[flag]` but reads more clearly at call sites.
 *
 * @param flag - The flag key to check.
 * @returns `true` if the flag is enabled, `false` otherwise (including on errors).
 */
export async function isEnabled(flag: keyof MigrationFeatureFlags): Promise<boolean> {
  const flags = await getFlags();
  return flags[flag];
}
