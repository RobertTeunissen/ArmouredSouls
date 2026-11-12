/**
 * useAchievementToasts response subscriber (issue #601, PR #604 review): an
 * unlock that pays credits or prestige re-reads the user, because the response
 * that carried it (equip, image change, …) doesn't return the new balance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { UnlockedAchievement } from '../../utils/achievementUtils';

const mocks = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  subscriber: null as ((data: unknown) => void) | null,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, refreshUser: mocks.refreshUser }),
}));
vi.mock('../../utils/api', () => ({
  api: { get: vi.fn().mockResolvedValue([]) },
  subscribeResponse: (fn: (data: unknown) => void) => {
    mocks.subscriber = fn;
    return () => { mocks.subscriber = null; };
  },
}));

import { useAchievementToasts } from '../useAchievementToasts';

const unlock = (overrides: Partial<UnlockedAchievement> = {}): UnlockedAchievement => ({
  id: 'E32', name: 'Ready for My Close-Up', description: 'Give a robot a custom image of your own', tier: 'easy',
  rewardCredits: 25_000, rewardPrestige: 25, badgeIconFile: 'achievement-e32', robotId: 3, robotName: 'Bot',
  ...overrides,
});

beforeEach(() => {
  mocks.refreshUser.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
});

describe('useAchievementToasts response subscriber', () => {
  it('queues the toast and refreshes the user when an unlock pays a reward', async () => {
    const { result } = renderHook(() => useAchievementToasts());

    act(() => mocks.subscriber?.({ robot: {}, achievementUnlocks: [unlock()] }));

    expect(result.current.toasts.map((t) => t.id)).toEqual(['E32']);
    await waitFor(() => expect(mocks.refreshUser).toHaveBeenCalledTimes(1));
  });

  it('does not refresh for a Trophy, which pays nothing', () => {
    const { result } = renderHook(() => useAchievementToasts());

    act(() => mocks.subscriber?.({ achievementUnlocks: [unlock({ id: 'E6', trophy: true, rewardCredits: 0, rewardPrestige: 0 })] }));

    expect(result.current.toasts).toHaveLength(1);
    expect(mocks.refreshUser).not.toHaveBeenCalled();
  });

  it('does not refresh for responses without unlocks', () => {
    renderHook(() => useAchievementToasts());

    act(() => {
      mocks.subscriber?.({ robot: {} });
      mocks.subscriber?.({ achievementUnlocks: [] });
    });

    expect(mocks.refreshUser).not.toHaveBeenCalled();
  });

  it('keeps the toast when the refresh fails', async () => {
    mocks.refreshUser.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAchievementToasts());

    act(() => mocks.subscriber?.({ achievementUnlocks: [unlock()] }));

    await waitFor(() => expect(mocks.refreshUser).toHaveBeenCalled());
    expect(result.current.toasts).toHaveLength(1);
  });
});
