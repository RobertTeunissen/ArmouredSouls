import { api } from './api';

/**
 * Legacy quick summary retained for stableStore and facility balance refreshes.
 * Player-facing reporting now uses the versioned Finance Center API in financeApi.ts.
 */
export interface FinancialSummary {
  currentBalance: number;
  prestige: number;
  dailyOperatingCosts: number;
  dailyPassiveIncome: number;
  netPassiveIncome: number;
  prestigeMultiplier: number;
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  return api.get<FinancialSummary>('/api/finances/summary');
}
