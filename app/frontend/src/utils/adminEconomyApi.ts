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
  timestamp: string;
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
