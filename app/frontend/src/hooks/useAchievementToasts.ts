import { useState, useEffect, useCallback } from 'react';
import type { UnlockedAchievement } from '../utils/achievementUtils';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import apiClient from '../utils/apiClient';

const LAST_SEEN_KEY = 'achievementLastSeen';

export function useAchievementToasts(enabled = true) {
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Check for achievements unlocked since last visit when auth becomes available
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    const params: Record<string, string> = { limit: '20' };
    if (lastSeen) {
      params.since = lastSeen;
    }

    api
      .get<Array<UnlockedAchievement & { unlockedAt?: string }>>('/api/achievements/recent', { params })
      .then((unlocks) => {
        if (Array.isArray(unlocks) && unlocks.length > 0) {
          setToasts(prev => [...prev, ...unlocks]);
          const mostRecent = unlocks[0]?.unlockedAt;
          if (mostRecent) {
            localStorage.setItem(LAST_SEEN_KEY, mostRecent);
          }
        }
      })
      .catch(() => {
        // Silently ignore — achievement check is non-critical
      });
  }, [enabled, isAuthenticated]);

  // Axios response interceptor to watch for achievementUnlocks in any API
  // response. The interceptor must hook the underlying `apiClient` axios
  // instance — the typed `api` wrapper unwraps `response.data` and would
  // strip the `achievementUnlocks` envelope before we could inspect it.
  useEffect(() => {
    if (!enabled) return;

    const interceptorId = apiClient.interceptors.response.use(
      (response) => {
        const unlocks = response.data?.achievementUnlocks;
        if (Array.isArray(unlocks) && unlocks.length > 0) {
          setToasts(prev => [...prev, ...unlocks]);
          localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
        }
        return response;
      },
      (error) => Promise.reject(error),
    );

    return () => {
      apiClient.interceptors.response.eject(interceptorId);
    };
  }, [enabled]);

  const dismissToast = useCallback((index: number) => {
    setToasts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { toasts, dismissToast };
}
