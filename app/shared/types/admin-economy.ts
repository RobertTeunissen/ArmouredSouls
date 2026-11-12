/**
 * Wire contract for the admin Economy page: `GET /api/admin/economy`
 * (backend `services/admin/adminEconomyService.ts`).
 */

export interface EconomyFlow {
  key: string;
  label: string;
  amount: number;
}

export interface EconomyOverview {
  status: 'ready';
  scope: { stables: EconomyStableScope; window: EconomyWindow; fromCycle: number; toCycle: number; cycles: number };
  kpis: {
    earned: number;
    spent: number;
    net: number;
    earnedPerCycle: number;
    spentPerCycle: number;
    /** Repair costs ÷ battle income, one decimal percent; null without battle income. */
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

/** The cycles this window needs are still being summed (first visit after a deploy). */
export interface EconomyPreparing {
  status: 'preparing';
  scope: EconomyOverview['scope'];
  /** Cycles of the window and chart summed so far, and how many they need. */
  cyclesReady: number;
  cyclesNeeded: number;
  timestamp: string;
}

export interface EconomyRepairs {
  automatic: RepairTotals;
  manual: RepairTotals;
  total: RepairTotals;
  /** Player stables in scope that repaired, and that used Manual Repair; null when the scope has no players. */
  playerStables: { repairing: number; manual: number } | null;
  /** Every stable type in the same window, whatever the scope. Shares are one-decimal percentages. */
  byStableType: { stables: EconomyStableKind; repairs: number; paid: number; repairBayShare: number | null; manualShare: number | null }[];
}

export type EconomyResponse = EconomyOverview | EconomyPreparing;

export type EconomyStableScope = 'players' | 'automatons' | 'generated' | 'all';

/** The stable types a scope breaks down into (the scope without `all`). */
export type EconomyStableKind = Exclude<EconomyStableScope, 'all'>;
export type EconomyWindow = '7' | '14' | '30' | 'season';

/** Repairs of one kind (or all) in the window. full − repairBayDiscount − manualDiscount = paid. */
export interface RepairTotals {
  repairs: number;
  /** The shared repair formula's quote before any discount. */
  fullPrice: number;
  repairBayDiscount: number;
  manualDiscount: number;
  paid: number;
}
