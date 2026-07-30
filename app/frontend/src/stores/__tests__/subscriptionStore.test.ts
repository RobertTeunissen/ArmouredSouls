import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSubscriptionStore } from '../subscriptionStore';
import type { StableOverview } from '../subscriptionStore';

/**
 * The store exists to collapse five independent `useStableOverview` calls into
 * one request. Request-count assertions are therefore the point of these tests,
 * not an implementation detail: before the store, opening the Booking Office
 * fetched the overview twice and every toggle fetched it again, which is how
 * players ended up hitting the rate limiter.
 */

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn() },
}));

import { api } from '../../utils/api';
const mockGet = vi.mocked(api.get);

const overview: StableOverview = {
  robots: [
    {
      robotId: 1,
      robotName: 'Iron Fist',
      subscriptions: [{ eventType: 'league_1v1', status: 'active' }],
      heldSlots: [],
      cap: 3,
    },
  ],
  registeredEvents: [{ type: 'league_1v1', label: '1v1 League' }],
  bookingOfficeLevel: 0,
  nextSchedulingMoments: { league_1v1: '2026-07-31T08:00:00.000Z' },
};

function resetStore(): void {
  useSubscriptionStore.setState({
    overview: null,
    loading: false,
    error: null,
    lastFetched: null,
    inFlight: null,
  });
}

describe('subscriptionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mockGet.mockResolvedValue(overview);
  });

  describe('fetchOverview', () => {
    it('should load the overview', async () => {
      await useSubscriptionStore.getState().fetchOverview();

      expect(mockGet).toHaveBeenCalledWith('/api/subscriptions/overview');
      expect(useSubscriptionStore.getState().overview).toEqual(overview);
      expect(useSubscriptionStore.getState().error).toBeNull();
      expect(useSubscriptionStore.getState().loading).toBe(false);
    });

    it('should make one request for simultaneous callers', async () => {
      const store = useSubscriptionStore.getState();

      await Promise.all([
        store.fetchOverview(),
        store.fetchOverview(),
        store.fetchOverview(),
        store.fetchOverview(),
        store.fetchOverview(),
      ]);

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should serve a fresh copy from cache without refetching', async () => {
      await useSubscriptionStore.getState().fetchOverview();
      await useSubscriptionStore.getState().fetchOverview();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should refetch once the cached copy has aged out', async () => {
      await useSubscriptionStore.getState().fetchOverview();

      useSubscriptionStore.setState({ lastFetched: Date.now() - 60_000 });
      await useSubscriptionStore.getState().fetchOverview();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('should record the error and keep the previous copy on failure', async () => {
      await useSubscriptionStore.getState().fetchOverview();

      mockGet.mockRejectedValue(new Error('network down'));
      useSubscriptionStore.setState({ lastFetched: null });
      await useSubscriptionStore.getState().fetchOverview();

      expect(useSubscriptionStore.getState().error).toBeTruthy();
      expect(useSubscriptionStore.getState().overview).toEqual(overview);
      expect(useSubscriptionStore.getState().loading).toBe(false);
    });

    it('should clear the in-flight promise after a failure so the next call retries', async () => {
      mockGet.mockRejectedValue(new Error('network down'));
      await useSubscriptionStore.getState().fetchOverview();

      expect(useSubscriptionStore.getState().inFlight).toBeNull();

      mockGet.mockResolvedValue(overview);
      await useSubscriptionStore.getState().fetchOverview();

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(useSubscriptionStore.getState().overview).toEqual(overview);
    });
  });

  describe('refresh', () => {
    it('should always refetch, cache or no cache', async () => {
      await useSubscriptionStore.getState().fetchOverview();
      await useSubscriptionStore.getState().refresh();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidate', () => {
    it('should drop the cached copy so the next read refetches', async () => {
      await useSubscriptionStore.getState().fetchOverview();

      useSubscriptionStore.getState().invalidate();
      expect(useSubscriptionStore.getState().overview).toBeNull();

      await useSubscriptionStore.getState().fetchOverview();
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
