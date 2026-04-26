import { useState, useEffect, useCallback, useRef } from 'react';
import type { UnlockedAchievement } from '../utils/achievementUtils';
import apiClient from '../utils/apiClient';

const LAST_SEEN_KEY = 'achievementLastSeen';

export function useAchievementToasts(enabled = true) {
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);
  const checkedRef = useRef(false);

  useEffect(() => {
    // On mount, check for achievements unlocked since last visit (e.g. from server-side battles)
    if (!enabled) return;
    if (!checkedRef.current) {
      checkedRef.current = true;
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const token = localStorage.getItem('token');
      if (token) {
        const params: Record<string, string> = { limit: '20' };
        if (lastSeen) {
          params.since = lastSeen;
        }
        apiClient
          .get('/api/achievements/recent', { params })
          .then((res) => {
            const unlocks = res.data;
            if (Array.isArray(unlocks) && unlocks.length > 0) {
              setToasts(prev => [...prev, ...unlocks]);
              // Update last seen to the most recent unlock timestamp
              const mostRecent = unlocks[0]?.unlockedAt;
              if (mostRecent) {
                localStorage.setItem(LAST_SEEN_KEY, mostRecent);
              }
            }
          })
          .catch(() => {
            // Silently ignore — achievement check is non-critical
          });
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Add Axios response interceptor to watch for achievementUnlocks in any API response
    const interceptorId = apiClient.interceptors.response.use(
      (response) => {
        const unlocks = response.data?.achievementUnlocks;
        if (Array.isArray(unlocks) && unlocks.length > 0) {
          setToasts(prev => [...prev, ...unlocks]);
          // Update last seen timestamp so these don't show again on next page load
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
