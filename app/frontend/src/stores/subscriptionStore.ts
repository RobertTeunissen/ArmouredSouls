/**
 * useSubscriptionStore — one shared copy of the Booking Office overview.
 *
 * Five components need this data (the matrix, the Booking Office page header, the
 * dashboard standings summary, the team management page and the robots list).
 * Each used to own its own `useStableOverview` call, so simply opening the page
 * fired the request twice, and every subscription toggle refetched it again. On a
 * full roster that added up to enough traffic to trip the rate limiter.
 *
 * Concurrent callers now share a single in-flight promise, and a short TTL keeps
 * navigation between pages from refetching. Mutations call `refresh()` explicitly
 * once they are done, rather than each cell refetching for itself.
 */
import { create } from 'zustand';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StableOverviewRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: string }[];
  /** Events with a match already booked — the slot is not free yet. */
  heldSlots: string[];
  cap: number;
}

export interface StableOverview {
  robots: StableOverviewRobot[];
  registeredEvents: { type: string; label: string }[];
  bookingOfficeLevel: number;
  /** Next moment each event books matches, ISO-8601 UTC, keyed by event type. */
  nextSchedulingMoments: Record<string, string>;
}

const TTL_MS = 30_000;

interface SubscriptionStoreState {
  overview: StableOverview | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  /** Shared in-flight request, so simultaneous callers make one call. */
  inFlight: Promise<void> | null;

  /** Fetch unless a fresh copy is already in hand. */
  fetchOverview: () => Promise<void>;
  /** Force a refetch — call after a save. */
  refresh: () => Promise<void>;
  /** Drop the cache, e.g. after a Booking Office upgrade changes the cap. */
  invalidate: () => void;
}

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
  overview: null,
  loading: false,
  error: null,
  lastFetched: null,
  inFlight: null,

  fetchOverview: async () => {
    const { inFlight, lastFetched, overview } = get();

    if (inFlight) return inFlight;
    if (overview && lastFetched && Date.now() - lastFetched < TTL_MS) return;

    const request = (async () => {
      set({ loading: true, error: null });
      try {
        const data = await api.get<StableOverview>('/api/subscriptions/overview');
        set({ overview: data, lastFetched: Date.now(), error: null });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to load subscription overview';
        set({ error: message });
      } finally {
        set({ loading: false, inFlight: null });
      }
    })();

    set({ inFlight: request });
    return request;
  },

  refresh: async () => {
    set({ lastFetched: null });
    return get().fetchOverview();
  },

  invalidate: () => set({ overview: null, lastFetched: null }),
}));

// ---------------------------------------------------------------------------
// Selectors — always subscribe to a slice, never the whole store
// ---------------------------------------------------------------------------

export const selectOverview = (s: SubscriptionStoreState): StableOverview | null => s.overview;
export const selectOverviewLoading = (s: SubscriptionStoreState): boolean => s.loading;
export const selectOverviewError = (s: SubscriptionStoreState): string | null => s.error;
