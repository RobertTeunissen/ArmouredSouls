import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../../utils/ApiError';

const mockGet = vi.fn();
const mockPut = vi.fn();
vi.mock('../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args), put: (...args: unknown[]) => mockPut(...args) },
}));

const store = vi.hoisted(() => ({
  state: {
    overview: null as unknown,
    loading: false,
    error: null as string | null,
    fetchOverview: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../stores/subscriptionStore', () => ({
  useSubscriptionStore: Object.assign(
    (selector: (s: typeof store.state) => unknown) => selector(store.state),
    { getState: () => store.state },
  ),
}));

import { saveRobotSubscriptions, useEventRegistry, useStableOverview } from '../useSubscriptions';

beforeEach(() => {
  vi.clearAllMocks();
  store.state.overview = { robots: [], registeredEvents: [] };
  store.state.error = null;
});

describe('useStableOverview', () => {
  it('reads the shared store and asks it to load once', () => {
    const { result } = renderHook(() => useStableOverview());
    expect(result.current.data).toEqual({ robots: [], registeredEvents: [] });
    expect(store.state.fetchOverview).toHaveBeenCalledTimes(1);
    expect(result.current.refetch).toBe(store.state.refresh);
  });
});

describe('saveRobotSubscriptions', () => {
  it('saves the whole set and refreshes the shared overview', async () => {
    mockPut.mockResolvedValue({ success: true, added: ['koth'], removed: [], heldSlots: [], occupiedCount: 1, cap: 2, level: 1 });
    const result = await saveRobotSubscriptions(5, ['koth']);
    expect(mockPut).toHaveBeenCalledWith('/api/subscriptions/robot/5', { eventTypes: ['koth'] });
    expect(result.added).toEqual(['koth']);
    expect(store.state.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the save is rejected', async () => {
    mockPut.mockRejectedValue(new ApiError('Cap exceeded', 'SUBSCRIPTION_CAP_EXCEEDED', 400));
    await expect(saveRobotSubscriptions(5, ['koth', 'grand_melee'])).rejects.toThrow('Cap exceeded');
    expect(store.state.refresh).not.toHaveBeenCalled();
  });
});

describe('useEventRegistry', () => {
  it('loads the events', async () => {
    mockGet.mockResolvedValue({ events: [{ type: 'koth', label: 'KotH', eligible: true }] });
    const { result } = renderHook(() => useEventRegistry());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/api/subscriptions/registry');
    expect(result.current.events).toEqual([{ type: 'koth', label: 'KotH', eligible: true }]);
    expect(result.current.error).toBeNull();
  });

  it('shows the API message, or a fallback for other failures', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('Registry unavailable', 'X', 503));
    const first = renderHook(() => useEventRegistry());
    await waitFor(() => expect(first.result.current.error).toBe('Registry unavailable'));

    mockGet.mockRejectedValueOnce(new Error('socket'));
    const second = renderHook(() => useEventRegistry());
    await waitFor(() => expect(second.result.current.error).toBe('Failed to load event registry'));
  });
});
