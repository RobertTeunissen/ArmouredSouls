import { create } from 'zustand';
import { getStableStatistics, StableStatistics } from '../utils/userApi';
import { getFinancialSummary, FinancialSummary } from '../utils/financialApi';

export interface StableState {
  currency: number;
  prestige: number;
  stats: StableStatistics | null;
  financialSummary: FinancialSummary | null;
  loading: boolean;
  error: string | null;
  fetchStableData: () => Promise<void>;
  refreshCurrency: () => Promise<void>;
  clear: () => void;
}

const initialState = {
  currency: 0,
  prestige: 0,
  stats: null as StableStatistics | null,
  financialSummary: null as FinancialSummary | null,
  loading: false,
  error: null as string | null,
};

export const useStableStore = create<StableState>((set) => ({
  ...initialState,

  fetchStableData: async () => {
    set({ loading: true, error: null });
    try {
      const [stats, financialSummary] = await Promise.all([
        getStableStatistics(),
        getFinancialSummary(),
      ]);
      set({
        stats,
        financialSummary,
        currency: financialSummary.currentBalance,
        prestige: stats.prestige,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch stable data',
        loading: false,
      });
    }
  },

  refreshCurrency: async () => {
    try {
      const financialSummary = await getFinancialSummary();
      set({
        financialSummary,
        currency: financialSummary.currentBalance,
        prestige: financialSummary.prestige,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to refresh currency',
      });
    }
  },

  clear: () => set({ ...initialState }),
}));
