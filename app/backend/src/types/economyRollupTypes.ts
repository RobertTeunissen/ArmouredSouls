/**
 * JSON shapes of `economy_cycle_rollups` (one closed ledger cycle's totals for
 * the admin Economy page). Written and read by
 * `services/admin/economyCycleRollups.ts`.
 */

/** Stable kind of a ledger row's stable when the cycle was summed. */
export type EconomyRollupKind = 'players' | 'automatons' | 'generated' | 'other';

/** Credits in and out of one transaction type for one stable kind. */
export interface EconomyFlowRollup {
  kind: EconomyRollupKind;
  transactionType: string;
  /** Sum of positive amounts. */
  income: number;
  /** Sum of negative amounts, as a positive number. */
  spend: number;
}

/** Repairs of one stable kind and repair type, with the quote breakdown. */
export interface EconomyRepairRollup {
  kind: EconomyRollupKind;
  repairType: 'automatic' | 'manual';
  repairs: number;
  /** `metadata.baseQuote`, or what was paid for rows without a breakdown. */
  fullPrice: number;
  /** `metadata.quoteBeforeManualDiscount`, or what was paid. */
  afterRepairBay: number;
  paid: number;
  /** Player stables that repaired this way in the cycle (only for kind `players`). */
  stableIds: number[];
}
