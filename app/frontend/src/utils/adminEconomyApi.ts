/**
 * Typed API of the admin Economy page (`/admin/economy`).
 * Mirrors `app/backend/src/services/admin/adminEconomyService.ts`.
 */
import { api } from './api';

export type EconomyStableScope = 'players' | 'automatons' | 'generated' | 'all';
export type EconomyWindow = '7' | '14' | '30' | 'season';
export type EconomyStableKind = Exclude<EconomyStableScope, 'all'>;

export interface EconomyFlow {
  key: string;
  label: string;
  amount: number;
}

export interface EconomyOverview {
  scope: { stables: EconomyStableScope; window: EconomyWindow; fromCycle: number; toCycle: number; cycles: number };
  kpis: {
    earned: number;
    spent: number;
    net: number;
    earnedPerCycle: number;
    spentPerCycle: number;
    repairsShareOfBattleIncome: number | null;
    heldNow: number;
    medianBalance: number;
    stables: number;
  };
  sources: EconomyFlow[];
  sinks: EconomyFlow[];
  perCycle: { cycle: number; earned: number; spent: number }[];
  balanceBands: { label: string; count: number; negative: boolean }[];
  byStableType: { stables: EconomyStableKind; count: number; earned: number; spent: number; net: number; heldNow: number }[];
  repairs: EconomyRepairs;
  timestamp: string;
}

/** Repairs of one kind (or all) in the window. fullPrice − repairBayDiscount − manualDiscount = paid. */
export interface RepairTotals {
  repairs: number;
  fullPrice: number;
  repairBayDiscount: number;
  manualDiscount: number;
  paid: number;
}

export interface EconomyRepairs {
  automatic: RepairTotals;
  manual: RepairTotals;
  total: RepairTotals;
  /** Player stables in scope that repaired, and that used Manual Repair; null when the scope has no players. */
  playerStables: { repairing: number; manual: number } | null;
  /** Every stable type in the same window. Shares are one-decimal percentages. */
  byStableType: { stables: EconomyStableKind; repairs: number; paid: number; repairBayShare: number | null; manualShare: number | null }[];
}

export const getEconomyOverview = (
  stables: EconomyStableScope,
  window: EconomyWindow,
  options: { fresh?: boolean; signal?: AbortSignal } = {},
): Promise<EconomyOverview> =>
  api.get<EconomyOverview>('/api/admin/economy', {
    params: { stables, window, ...(options.fresh ? { fresh: 'true' } : {}) },
    signal: options.signal,
  });
