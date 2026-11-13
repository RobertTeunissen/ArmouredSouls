/**
 * Dashboard API reads — Spec #48.
 *
 * The response contract is `CycleProgressSummary` in `app/shared/types/dashboard.ts`.
 */

import { api } from './api';
import type { CycleProgressSummary } from '@shared/types';

/** One authenticated read supplying every changing figure on the Overview_Row. */
export const fetchCycleProgressSummary = async (): Promise<CycleProgressSummary> => {
  return api.get<CycleProgressSummary>('/api/dashboard/current-cycle');
};
