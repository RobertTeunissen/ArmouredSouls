import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStableStore } from '../stableStore';
import type { StableStatistics } from '../../utils/userApi';
import type { FinancialSummary } from '../../utils/financialApi';

// Mock the API modules
vi.mock('../../utils/userApi', () => ({
  getStableStatistics: vi.fn(),
}));

vi.mock('../../utils/financialApi', () => ({
  getFinancialSummary: vi.fn(),
}));

// Import the mocked functions after vi.mock
import { getStableStatistics } from '../../utils/userApi';
import { getFinancialSummary } from '../../utils/financialApi';
const mockGetStableStatistics = vi.mocked(getStableStatistics);
const mockGetFinancialSummary = vi.mocked(getFinancialSummary);

const mockStats: StableStatistics = {
  totalBattles: 50,
  wins: 30,
  losses: 15,
  draws: 5,
  winRate: 60,
  highestELO: 1500,
  highestLeague: 'Gold',
  highestTagTeamLeague: null,
  totalRobots: 3,
  prestige: 200,
  prestigeRank: 'Veteran',
  cycleChanges: null,
};

const mockFinancialSummary: FinancialSummary = {
  currentBalance: 5000,
  prestige: 200,
  dailyOperatingCosts: 100,
  dailyPassiveIncome: 250,
  netPassiveIncome: 150,
  prestigeMultiplier: 1.2,
};

describe('stableStore', () => {
  beforeEach(() => {
    useStableStore.setState({
      currency: 0,
      prestige: 0,
      stats: null,
      financialSummary: null,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have currency set to 0', () => {
      expect(useStableStore.getState().currency).toBe(0);
    });

    it('should have prestige set to 0', () => {
      expect(useStableStore.getState().prestige).toBe(0);
    });

    it('should have stats set to null', () => {
      expect(useStableStore.getState().stats).toBeNull();
    });

    it('should have financialSummary set to null', () => {
      expect(useStableStore.getState().financialSummary).toBeNull();
    });

    it('should have loading set to false', () => {
      expect(useStableStore.getState().loading).toBe(false);
    });

    it('should have error set to null', () => {
      expect(useStableStore.getState().error).toBeNull();
    });
  });

  describe('fetchStableData', () => {
    it('should set loading to true while fetching', async () => {
      let resolveStats: (value: StableStatistics) => void;
      let resolveFinancial: (value: FinancialSummary) => void;
      mockGetStableStatistics.mockImplementation(
        () => new Promise<StableStatistics>((r) => { resolveStats = r; })
      );
      mockGetFinancialSummary.mockImplementation(
        () => new Promise<FinancialSummary>((r) => { resolveFinancial = r; })
      );

      const fetchPromise = useStableStore.getState().fetchStableData();
      expect(useStableStore.getState().loading).toBe(true);
      expect(useStableStore.getState().error).toBeNull();

      resolveStats!(mockStats);
      resolveFinancial!(mockFinancialSummary);
      await fetchPromise;
    });

    it('should populate state on success', async () => {
      mockGetStableStatistics.mockResolvedValue(mockStats);
      mockGetFinancialSummary.mockResolvedValue(mockFinancialSummary);

      await useStableStore.getState().fetchStableData();

      const state = useStableStore.getState();
      expect(state.stats).toEqual(mockStats);
      expect(state.financialSummary).toEqual(mockFinancialSummary);
      expect(state.currency).toBe(5000);
      expect(state.prestige).toBe(200);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockGetStableStatistics.mockRejectedValue(new Error('Network error'));
      mockGetFinancialSummary.mockResolvedValue(mockFinancialSummary);

      await useStableStore.getState().fetchStableData();

      const state = useStableStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle non-Error rejection with fallback message', async () => {
      mockGetStableStatistics.mockRejectedValue('something went wrong');
      mockGetFinancialSummary.mockResolvedValue(mockFinancialSummary);

      await useStableStore.getState().fetchStableData();

      expect(useStableStore.getState().error).toBe('Failed to fetch stable data');
    });

    it('should clear previous error on new fetch', async () => {
      // First call fails
      mockGetStableStatistics.mockRejectedValueOnce(new Error('fail'));
      mockGetFinancialSummary.mockResolvedValue(mockFinancialSummary);
      await useStableStore.getState().fetchStableData();
      expect(useStableStore.getState().error).toBe('fail');

      // Second call succeeds
      mockGetStableStatistics.mockResolvedValueOnce(mockStats);
      await useStableStore.getState().fetchStableData();

      const state = useStableStore.getState();
      expect(state.error).toBeNull();
      expect(state.stats).toEqual(mockStats);
    });
  });

  describe('refreshCurrency', () => {
    it('should update currency and financialSummary without setting loading', async () => {
      const updatedSummary: FinancialSummary = {
        ...mockFinancialSummary,
        currentBalance: 4500,
        prestige: 210,
      };
      mockGetFinancialSummary.mockResolvedValue(updatedSummary);

      await useStableStore.getState().refreshCurrency();

      const state = useStableStore.getState();
      expect(state.currency).toBe(4500);
      expect(state.prestige).toBe(210);
      expect(state.financialSummary).toEqual(updatedSummary);
      expect(state.loading).toBe(false);
    });

    it('should set error on failure', async () => {
      mockGetFinancialSummary.mockRejectedValue(new Error('Refresh failed'));

      await useStableStore.getState().refreshCurrency();

      expect(useStableStore.getState().error).toBe('Refresh failed');
    });

    it('should handle non-Error rejection with fallback message', async () => {
      mockGetFinancialSummary.mockRejectedValue('oops');

      await useStableStore.getState().refreshCurrency();

      expect(useStableStore.getState().error).toBe('Failed to refresh currency');
    });
  });

  describe('clear', () => {
    it('should reset state to initial values', async () => {
      // Populate the store first
      mockGetStableStatistics.mockResolvedValue(mockStats);
      mockGetFinancialSummary.mockResolvedValue(mockFinancialSummary);
      await useStableStore.getState().fetchStableData();
      expect(useStableStore.getState().currency).toBe(5000);

      // Clear
      useStableStore.getState().clear();

      const state = useStableStore.getState();
      expect(state.currency).toBe(0);
      expect(state.prestige).toBe(0);
      expect(state.stats).toBeNull();
      expect(state.financialSummary).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear error state', () => {
      useStableStore.setState({ error: 'some error' });
      useStableStore.getState().clear();
      expect(useStableStore.getState().error).toBeNull();
    });
  });
});
