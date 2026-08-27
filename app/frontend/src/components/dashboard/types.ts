/**
 * View-model types for the Overview_Row — Spec #48.
 */

import type { CycleProgressSummary } from '../../utils/dashboardApi';

/** Everything the Overview_Row needs, assembled by `useDashboardData`. */
export interface OverviewRowData {
  /**
   * From the auth context, so both survive a Cycle_Progress_Summary failure
   * (Requirement 3 criterion 1, Requirement 6 criterion 10). The context is refreshed
   * on Dashboard mount so these describe the same moment as the cycle figures beside
   * them (Requirement 3 criterion 10).
   */
  prestigeTotal: number;
  creditBalance: number;
  robotCount: number;
  isPreparationPhase: boolean;
  /** The Cycle_Progress_Summary response, or null while loading / on failure. */
  cycleProgress: CycleProgressSummary | null;
  isLoading: boolean;
  error: string | null;
}
