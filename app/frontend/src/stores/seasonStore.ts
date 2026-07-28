/**
 * Season store (Spec #45).
 *
 * Season state is read by the navigation, the Dashboard, the countdown banner,
 * and the summary modal — four consumers across the tree — so it lives in a
 * store rather than being fetched per component. Always subscribe with a
 * selector, never to the whole store.
 */

import { create } from 'zustand';
import { getCurrentSeason, type SeasonState as SeasonStateDto } from '../utils/seasonApi';
import { createLogger } from '../utils/logger';

const log = createLogger('seasonStore');

export interface SeasonStoreState {
  season: SeasonStateDto | null;
  loading: boolean;
  /**
   * True when the last fetch failed. Surfaces so the progress indicator can
   * hide itself rather than render a stale or placeholder cycle number.
   */
  failed: boolean;
  /** Season number whose countdown banner the player dismissed, and the cycle they did it on. */
  dismissedBanner: { seasonNumber: number; seasonCycle: number } | null;
  fetchSeason: () => Promise<void>;
  dismissBanner: () => void;
  clear: () => void;
}

export const useSeasonStore = create<SeasonStoreState>((set, get) => ({
  season: null,
  loading: false,
  failed: false,
  dismissedBanner: null,

  fetchSeason: async () => {
    // The season endpoint requires authentication, so skip the request entirely
    // when there is no token. Without this guard the app shell fires a doomed
    // request on every mount — including in component tests that render the
    // navigation without a logged-in user.
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('token')) {
      set({ loading: false, failed: false, season: null });
      return;
    }
    // Already loading: a second mount should not duplicate the request.
    if (get().loading) return;

    set({ loading: true });
    try {
      const season = await getCurrentSeason();
      set({ season, loading: false, failed: false });
    } catch (error) {
      // Omit rather than guess: a wrong cycle number is worse than none.
      log.error('Failed to load season state', error);
      set({ loading: false, failed: true, season: null });
    }
  },

  dismissBanner: () => {
    const season = get().season;
    if (!season) return;
    set({
      dismissedBanner: {
        seasonNumber: season.seasonNumber,
        seasonCycle: season.seasonCycle,
      },
    });
  },

  clear: () => set({ season: null, loading: false, failed: false, dismissedBanner: null }),
}));

// ─── Selectors ───────────────────────────────────────────────────────

export const selectSeason = (s: SeasonStoreState): SeasonStateDto | null => s.season;
export const selectSeasonFailed = (s: SeasonStoreState): boolean => s.failed;

/** Whether the countdown banner should show right now. */
export function selectShouldShowCountdown(countdownCycles: number) {
  return (s: SeasonStoreState): boolean => {
    const season = s.season;
    if (!season || season.phase !== 'competitive' || season.isLegacy) return false;
    if (season.remainingCompetitiveCycles > countdownCycles) return false;
    // Dismissal lasts for the remainder of the cycle only.
    const dismissed = s.dismissedBanner;
    if (
      dismissed &&
      dismissed.seasonNumber === season.seasonNumber &&
      dismissed.seasonCycle === season.seasonCycle
    ) {
      return false;
    }
    return true;
  };
}
