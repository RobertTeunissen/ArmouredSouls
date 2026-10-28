/**
 * Recorded facility returns — pure helpers for historical facility ROI.
 *
 * Historical returns are derived from the facts stored on each financial event
 * at the time it happened, never from the current formula or the current
 * facility level (FINANCIAL_LEDGER_AUDIT_GUIDE.md: reports use stored facts).
 *
 * Two forms of each calculation live here:
 *
 * - The per-row helpers (`sumStudioAttributableStreaming`,
 *   `sumRepairBaySavingsFromRecords`) are the reference contract: they define
 *   which rows count and what each contributes.
 * - The grouped helpers (`…FromGroups`) are what production uses (#542). The
 *   database groups the stable's rows by the stored key (`studioMultiplier`,
 *   `discountPercent`) and sums the amount per group, so the query returns at
 *   most one row per distinct key regardless of history length. Each per-row
 *   term is linear in the summed amount for a fixed key, and both forms round
 *   once at the end (`roundSummedCredits`, which ignores floating-point
 *   noise), so the grouped total equals the per-row total.
 */

import { readRepairChargedCredits } from './repairPayloadKeys';

/** A recorded `streaming_revenue` ledger row: the amount paid and its stored breakdown. */
export interface RecordedStreamingRow {
  amount: number;
  metadata: unknown;
}

/**
 * Recorded streaming awards that share one stored `studioMultiplier`, summed.
 * `studioMultiplier` is the raw stored JSON value; it is validated here, not
 * in SQL, with the same rule the per-row helper applies.
 */
export interface StudioStreamingGroup {
  studioMultiplier: unknown;
  amountSum: number;
}

/**
 * Recorded repairs that share one stored `discountPercent`, with their charged
 * credits (`creditsCharged`, else legacy `cost`) summed. `discountPercent` is
 * the raw stored JSON value, validated here.
 */
export interface RepairChargedGroup {
  discountPercent: unknown;
  chargedSum: number;
}

/** A stored studio multiplier that counts: a finite number ≥ 1. */
export function isRecordedStudioMultiplier(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1;
}

/** A stored Repair Bay discount that counts: a finite number in [0, 100). */
export function isRecordedRepairDiscountPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100;
}

/** Decimal places kept before the final rounding; far above the float noise of these sums. */
const SUM_SNAP_DECIMALS = 6;

/**
 * Round a summed credit total to whole credits, ignoring floating-point noise.
 *
 * The per-row and grouped forms add the same exact value in a different order,
 * so their float results can differ in the last bits. When the exact total is
 * a tie (e.g. thirds from a 1.5 or 6.0 studio multiplier summing to x.5), that
 * noise decides whether `Math.round` goes up or down. Snapping to
 * `SUM_SNAP_DECIMALS` places first makes both forms round the same exact value.
 */
export function roundSummedCredits(total: number): number {
  const scale = 10 ** SUM_SNAP_DECIMALS;
  return Math.round(Math.round(total * scale) / scale);
}

function readStudioMultiplier(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).studioMultiplier;
  return isRecordedStudioMultiplier(value) ? value : null;
}

/**
 * Streaming revenue attributable to the Streaming Studio across recorded awards.
 *
 * Every award is `base × audience × studioMultiplier` (then floored and, for
 * team matches, shared), so the studio's share of an award is
 * `amount × (1 − 1 / studioMultiplier)`: what the robot earned beyond what it
 * would have earned without a studio. Uses each row's stored
 * `studioMultiplier`, which both formula versions ('1' and '2') record.
 *
 * Rows without a finite `studioMultiplier ≥ 1` (legacy or malformed metadata)
 * are skipped. The sum is rounded once at the end.
 */
export function sumStudioAttributableStreaming(rows: ReadonlyArray<RecordedStreamingRow>): number {
  let total = 0;
  for (const row of rows) {
    const studioMultiplier = readStudioMultiplier(row.metadata);
    if (studioMultiplier === null) {
      continue;
    }
    total += row.amount * (1 - 1 / studioMultiplier);
  }
  return roundSummedCredits(total);
}

/**
 * Grouped form of {@link sumStudioAttributableStreaming}: one term per stored
 * multiplier, `amountSum × (1 − 1 / studioMultiplier)`. Groups whose multiplier
 * would be skipped per row are skipped. Rounded once at the end.
 */
export function sumStudioAttributableStreamingFromGroups(
  groups: ReadonlyArray<StudioStreamingGroup>,
): number {
  let total = 0;
  for (const group of groups) {
    if (!isRecordedStudioMultiplier(group.studioMultiplier) || !Number.isFinite(group.amountSum)) {
      continue;
    }
    total += group.amountSum * (1 - 1 / group.studioMultiplier);
  }
  return roundSummedCredits(total);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Credits the Repair Bay saved across recorded `robot_repair` audit payloads.
 *
 * Each row records what was charged (`creditsCharged`, legacy `cost`) and the
 * Repair Bay discount that applied at the time (`discountPercent`, d). The
 * charge is the post-discount figure, so the saving on that row is
 * `charged × d / (100 − d)`. Using the row's own d means a change to the
 * discount formula (#525) never rewrites past savings.
 *
 * Rows with a missing or non-finite charge or discount, or a discount outside
 * [0, 100), are skipped. The sum is rounded once at the end.
 */
export function sumRepairBaySavingsFromRecords(payloads: ReadonlyArray<unknown>): number {
  let total = 0;
  for (const payload of payloads) {
    const record = asRecord(payload);
    if (record === null) {
      continue;
    }
    const charged = readRepairChargedCredits(record);
    const discountPercent = record.discountPercent;
    if (charged === null || !isRecordedRepairDiscountPercent(discountPercent)) {
      continue;
    }
    total += (charged * discountPercent) / (100 - discountPercent);
  }
  return roundSummedCredits(total);
}

/**
 * Grouped form of {@link sumRepairBaySavingsFromRecords}: one term per stored
 * discount, `chargedSum × d / (100 − d)`. Groups whose discount would be
 * skipped per row, or whose charged sum is not finite, are skipped. Rounded
 * once at the end.
 */
export function sumRepairBaySavingsFromGroups(groups: ReadonlyArray<RepairChargedGroup>): number {
  let total = 0;
  for (const group of groups) {
    const discountPercent = group.discountPercent;
    if (!isRecordedRepairDiscountPercent(discountPercent) || !Number.isFinite(group.chargedSum)) {
      continue;
    }
    total += (group.chargedSum * discountPercent) / (100 - discountPercent);
  }
  return roundSummedCredits(total);
}
