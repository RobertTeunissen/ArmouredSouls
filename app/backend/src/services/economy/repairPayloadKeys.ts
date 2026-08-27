/**
 * Read-both / write-new resolvers for the two repair JSON key transitions.
 *
 * Spec #48 Requirement 17 criteria 3, 4, 8, 10, 11 and 16.
 *
 * Two renames have no database migration because the keys live inside `Json`
 * columns:
 *
 *   `cycle_snapshots.stableMetrics[].totalRepairCosts` -> `cycleRepairCreditsPaid`
 *   `audit_logs.payload.cost`                          -> `creditsCharged`
 *   `audit_logs.payload.preDiscountCost`               -> `creditsBeforeManualDiscount`
 *
 * The old names were actively misleading. `totalRepairCosts` sits on a per-cycle
 * metric but reads as a lifetime figure. `cost` does not say whether it is money
 * charged or money quoted — the one distinction the manual repair discount turns
 * into two different numbers, and the confusion behind the double-discount bug
 * Requirement 18 fixes.
 *
 * REMOVABLE AT THE NEXT Season_Rollover. A rollover archives and then purges both
 * `cycle_snapshots` and `audit_logs` in full (Spec #45), so no row carrying an old
 * key survives it and every fallback below becomes dead code. Until then a fallback
 * is load-bearing: Requirement 9 criterion 11 leaves stored totals alone rather than
 * recomputing them, so a pre-rename row cannot always be re-derived.
 *
 * Each resolver reads the renamed key FIRST and never sums the two — a payload
 * carrying both must not double a repair total (criterion 16).
 */

/** Renamed keys. Written on every new row; read first on every row. */
export const CYCLE_REPAIR_SPEND_KEY = 'cycleRepairCreditsPaid' as const;
export const REPAIR_CHARGED_KEY = 'creditsCharged' as const;
export const REPAIR_PRE_DISCOUNT_KEY = 'creditsBeforeManualDiscount' as const;

/** Pre-rename keys, retained only for the read fallback. */
const LEGACY_CYCLE_REPAIR_SPEND_KEY = 'totalRepairCosts';
const LEGACY_REPAIR_CHARGED_KEY = 'cost';
const LEGACY_REPAIR_PRE_DISCOUNT_KEY = 'preDiscountCost';

/**
 * Resolve one numeric key, preferring the renamed form.
 *
 * Returns `null` for an absent key and for a present-but-non-numeric value, which
 * is how Requirement 9 criterion 10 is satisfied at every reader at once rather
 * than per call site: a malformed row is excluded from the total instead of
 * poisoning it with `NaN`.
 */
function resolveNumeric(
  source: Record<string, unknown> | null | undefined,
  renamedKey: string,
  legacyKey: string,
): number | null {
  if (source === null || source === undefined) return null;

  for (const key of [renamedKey, legacyKey]) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return null;
}

/**
 * Cycle_Repair_Spend out of a `stableMetrics` entry — credits charged for repairs
 * for one stable during one cycle.
 *
 * Returns 0 rather than null when neither key is present, because a stable with no
 * repairs that cycle genuinely spent nothing and every caller sums this.
 */
export function readCycleRepairSpend(metric: Record<string, unknown> | null | undefined): number {
  return (
    resolveNumeric(metric, CYCLE_REPAIR_SPEND_KEY, LEGACY_CYCLE_REPAIR_SPEND_KEY) ?? 0
  );
}

/**
 * The Repair_Spend_Source charged figure — the credits actually deducted for one
 * repair. Null when the row is malformed, so the caller can skip it.
 */
export function readRepairChargedCredits(
  payload: Record<string, unknown> | null | undefined,
): number | null {
  return resolveNumeric(payload, REPAIR_CHARGED_KEY, LEGACY_REPAIR_CHARGED_KEY);
}

/**
 * The Repair_Spend_Source pre-discount figure — the same repair priced before the
 * manual repair discount and after the Repair Bay discount.
 *
 * Null when neither key is present, which is the NORMAL case for an
 * Automatic_Repair_Path row: that path applies no manual discount, so it records no
 * pre-discount figure.
 *
 * Never an input to a spend total. Summing it would report manual spend at roughly
 * double what was charged and drop automatic spend entirely.
 */
export function readRepairPreDiscountCredits(
  payload: Record<string, unknown> | null | undefined,
): number | null {
  return resolveNumeric(payload, REPAIR_PRE_DISCOUNT_KEY, LEGACY_REPAIR_PRE_DISCOUNT_KEY);
}
