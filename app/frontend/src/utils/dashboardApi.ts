/**
 * Dashboard API types and reads — Spec #48.
 *
 * `CycleProgressSummary` mirrors `app/backend/src/types/dashboardTypes.ts`. Keep the
 * two in step: the backend one carries the reasoning for each field.
 */

import { api } from './api';

export interface RepairSpendByType {
  manual: number;
  automatic: number;
}

export interface BestPlacement {
  position: number;
  fieldSize: number;
}

export interface WinLossDraw {
  wins: number;
  losses: number;
  draws: number;
}

export interface CycleWindow {
  start: string;
  end: string;
  cycleNumber: number;
}

export interface CycleComparison {
  /** May not be `currentCycle - 1` if the Settlement_Job has not written it yet. */
  cycleNumber: number;
  prestigeEarned: number;
  battleEarnings: number;
  /** Null when Repair_Spend_Source rows for that window are absent. */
  repairSpend: RepairSpendByType | null;
}

export interface CycleProgressSummary {
  window: CycleWindow;
  battlesFought: number;
  /** Always `>= battlesFought`: fought matches plus those still ahead today. */
  matchesScheduled: number;
  /** `winLossBattles + placementBattles === battlesFought`, always. */
  winLossBattles: number;
  placementBattles: number;
  winLossDraw: WinLossDraw;
  bestPlacement: BestPlacement | null;
  remainingSlotsUtc: string[];
  nextSettlementAt: string;
  prestigeEarned: number;
  battleEarnings: number;
  repairSpend: RepairSpendByType;
  comparison: CycleComparison | null;
}

/** One authenticated read supplying every changing figure on the Overview_Row. */
export const fetchCycleProgressSummary = async (): Promise<CycleProgressSummary> => {
  return api.get<CycleProgressSummary>('/api/dashboard/current-cycle');
};
