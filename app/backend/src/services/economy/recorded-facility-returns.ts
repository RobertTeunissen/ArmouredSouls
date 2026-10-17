/**
 * Recorded facility returns — pure helpers for historical facility ROI.
 *
 * Historical returns are derived from the facts stored on each financial event
 * at the time it happened, never from the current formula or the current
 * facility level (FINANCIAL_LEDGER_AUDIT_GUIDE.md: reports use stored facts).
 */

import { readRepairChargedCredits } from './repairPayloadKeys';

/** A recorded `streaming_revenue` ledger row: the amount paid and its stored breakdown. */
export interface RecordedStreamingRow {
  amount: number;
  metadata: unknown;
}

function readStudioMultiplier(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>).studioMultiplier;
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? value : null;
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
  return Math.round(total);
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
    if (
      charged === null
      || typeof discountPercent !== 'number'
      || !Number.isFinite(discountPercent)
      || discountPercent < 0
      || discountPercent >= 100
    ) {
      continue;
    }
    total += (charged * discountPercent) / (100 - discountPercent);
  }
  return Math.round(total);
}
