import { useState, useEffect, useCallback } from 'react';
import type { UnlockedAchievement } from '../utils/achievementUtils';
import { useAuth } from '../contexts/AuthContext';
import { api, subscribeResponse } from '../utils/api';

const LAST_SEEN_KEY = 'achievementLastSeen';

/**
 * Surface achievement-unlock toasts. Two pathways feed `toasts`:
 *
 * 1. **One-shot recap on auth.** When the user logs in we fetch
 *    `/api/achievements/recent?since=<lastSeen>` so we don't miss unlocks
 *    that happened while the tab was closed.
 * 2. **Continuous via response subscriber.** Many gameplay endpoints
 *    embed `achievementUnlocks` in their response body. We register a
 *    callback on the typed `api` wrapper that watches every successful
 *    response and pulls those unlocks into the toast queue. The callback
 *    runs after `response.data` is unwrapped, so it sees the same
 *    payload callers see.
 */
export function useAchievementToasts(enabled = true) {
  const [toasts, setToasts] = useState<UnlockedAchievement[]>([]);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Pathway 1: recap-on-auth fetch.
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

  // Pathway 2: response-subscriber for achievementUnlocks envelopes.
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeResponse((data) => {
      const unlocks = (data as { achievementUnlocks?: UnlockedAchievement[] } | null)?.achievementUnlocks;
      if (Array.isArray(unlocks) && unlocks.length > 0) {
        setToasts(prev => [...prev, ...unlocks]);
        localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
      }
    });

    return unsubscribe;
  }, [enabled]);

  const dismissToast = useCallback((index: number) => {
    setToasts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return { toasts, dismissToast };
}
