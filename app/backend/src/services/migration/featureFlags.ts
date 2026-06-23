import prisma from '../../lib/prisma';

/**
 * Migration feature flags for Spec #40 — Database Unification.
 *
 * Flags are persisted in the `cycle_metadata.feature_flags` JSON column
 * and control which subsystems use the new unified schema vs legacy tables.
 * All flags default to `false` (legacy behavior) so a failed read is always
 * safe — the system falls back to the pre-migration code paths.
 */
export interface MigrationFeatureFlags {
  /** When true, credit/debit flows write to the new financial ledger table. */
  financial_ledger_active: boolean;
  /** When true, leaderboard queries read from the materialized cache table. */
  leaderboard_cache_active: boolean;
  /** When true, legacy tables have been dropped and migration is complete. */
  legacy_tables_dropped: boolean;
}

/** Fail-safe defaults — all flags off means legacy behavior. */
const DEFAULT_FLAGS: MigrationFeatureFlags = {
  financial_ledger_active: false,
  leaderboard_cache_active: false,
  legacy_tables_dropped: false,
};

/**
 * Read the current migration feature flags from `cycle_metadata` (id=1).
 *
 * On any failure (missing row, malformed JSON, DB error) the function
 * returns the default flags so the system stays on the legacy path.
 */
export async function getFlags(): Promise<MigrationFeatureFlags> {
  try {
    const row = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
      select: { featureFlags: true },
    });

    if (!row) {
      return { ...DEFAULT_FLAGS };
    }

    const stored = row.featureFlags as unknown as Partial<MigrationFeatureFlags>;

    return {
      ...DEFAULT_FLAGS,
      ...stored,
    };
  } catch {
    // Fail-safe: any read error falls back to legacy behavior.
    return { ...DEFAULT_FLAGS };
  }
}

/**
 * Update a single migration feature flag in `cycle_metadata` (id=1).
 *
 * Uses an upsert so the row is created if it doesn't exist yet.
 *
 * @param flag  - The flag key to update.
 * @param value - The new boolean value for the flag.
 */
export async function setFlag(
  flag: keyof MigrationFeatureFlags,
  value: boolean,
): Promise<void> {
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
