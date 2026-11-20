/**
 * JSON keys of the repair figures and their readers.
 *
 *   `cycle_snapshots.stableMetrics[].cycleRepairCreditsPaid` — repair credits charged in one cycle
 *   `audit_logs.payload.creditsCharged`                      — credits deducted for one repair
 *   `audit_logs.payload.creditsBeforeManualDiscount`         — the same repair before the manual discount
 *
 * Readers return `null` (or 0 for the per-cycle spend) for an absent or non-finite
 * value, so a malformed row is excluded from a total instead of poisoning it with `NaN`.
 */

export const CYCLE_REPAIR_SPEND_KEY = 'cycleRepairCreditsPaid' as const;
export const REPAIR_CHARGED_KEY = 'creditsCharged' as const;
export const REPAIR_PRE_DISCOUNT_KEY = 'creditsBeforeManualDiscount' as const;

function finiteNumber(source: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Cycle_Repair_Spend out of a `stableMetrics` entry — credits charged for repairs
 * for one stable during one cycle. 0 when absent: every caller sums it.
 */
export function readCycleRepairSpend(metric: Record<string, unknown> | null | undefined): number {
  return finiteNumber(metric, CYCLE_REPAIR_SPEND_KEY) ?? 0;
}

/**
 * The Repair_Spend_Source charged figure — the credits actually deducted for one
 * repair. Null when the row is malformed, so the caller can skip it.
 */
export function readRepairChargedCredits(payload: Record<string, unknown> | null | undefined): number | null {
  return finiteNumber(payload, REPAIR_CHARGED_KEY);
}
