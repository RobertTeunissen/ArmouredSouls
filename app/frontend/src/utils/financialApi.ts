import type { FinancialSummary } from '@shared/types';
import { api } from './api';

/**
 * Legacy quick summary retained for stableStore and facility balance refreshes.
 * Player-facing reporting now uses the versioned Finance Center API in financeApi.ts.
 */
export async function getFinancialSummary(): Promise<FinancialSummary> {
  return api.get<FinancialSummary>('/api/finances/summary');
}
