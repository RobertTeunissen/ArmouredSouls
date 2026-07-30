/**
 * useSubscriptions hooks
 *
 * Data fetching for robot subscriptions, the stable overview and the event
 * registry, plus the mutation functions behind them.
 *
 * `useStableOverview` is a thin wrapper over `useSubscriptionStore` so that every
 * component asking for the overview shares one request. It keeps the original
 * `{ data, loading, error, refetch }` shape, so existing callers did not change.
 *
 * Requirements: R9.2, R9.10
 */

import { useEffect, useCallback, useState } from 'react';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import type { StableOverview, StableOverviewRobot } from '../stores/subscriptionStore';

export type { StableOverview, StableOverviewRobot };

// ── Types ────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  robotId: number;
  eventType: string;
  status: string;
  createdAt: string;
}

export interface RobotSubscriptionInfo {
  subscriptions: Subscription[];
  cap: number;
  level: number;
  /** Events with a match already booked — the slot is not free yet. */
  heldSlots: string[];
  nextSchedulingMoments: Record<string, string>;
}

export interface EligibleEvent {
  type: string;
  label: string;
  eligible: boolean;
  reason?: string;
}

export interface RegistryResponse {
  events: EligibleEvent[];
}

/** Outcome of any subscription change — single toggle or bulk save. */
export interface SubscriptionChangeResult {
  success: boolean;
  message?: string;
  added: string[];
  removed: string[];
  heldSlots: string[];
  occupiedCount: number;
  cap: number;
  level: number;
}

/** Shape of the `details` payload on a SUBSCRIPTION_CAP_EXCEEDED error. */
export interface CapExceededDetails {
  currentCount: number;
  requestedCount?: number;
  cap: number;
  level: number;
  heldSlots?: string[];
}

// ── Hook: Robot Subscriptions ────────────────────────────────────────

export interface UseRobotSubscriptionsReturn {
  data: RobotSubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  subscribe: (eventType: string) => Promise<SubscriptionChangeResult>;
  unsubscribe: (eventType: string) => Promise<SubscriptionChangeResult>;
  /** Replace the whole set in one request. */
  saveSubscriptions: (eventTypes: string[]) => Promise<SubscriptionChangeResult>;
  mutating: boolean;
}

export function useRobotSubscriptions(robotId: number | null): UseRobotSubscriptionsReturn {
  const [data, setData] = useState<RobotSubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!robotId) return;
    setLoading(true);
    setError(null);
    try {
      const info = await api.get<RobotSubscriptionInfo>(`/api/subscriptions/robot/${robotId}`);
      setData(info);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load subscriptions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [robotId]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const mutate = useCallback(
    async (run: () => Promise<SubscriptionChangeResult>): Promise<SubscriptionChangeResult> => {
      setMutating(true);
      try {
        const result = await run();
        await fetchSubscriptions();
        // The stable-wide matrix reads from the shared store, so one refresh
        // keeps every other view in step without each of them refetching.
        await useSubscriptionStore.getState().refresh();
        return result;
      } finally {
        setMutating(false);
      }
    },
    [fetchSubscriptions],
  );

  const subscribe = useCallback(
    (eventType: string) => {
      if (!robotId) throw new Error('No robot selected');
      return mutate(() =>
        api.post<SubscriptionChangeResult>(
          `/api/subscriptions/robot/${robotId}/subscribe`,
          { eventType },
        ),
      );
    },
    [robotId, mutate],
  );

  const unsubscribe = useCallback(
    (eventType: string) => {
      if (!robotId) throw new Error('No robot selected');
      return mutate(() =>
        api.post<SubscriptionChangeResult>(
          `/api/subscriptions/robot/${robotId}/unsubscribe`,
          { eventType },
        ),
      );
    },
    [robotId, mutate],
  );

  const saveSubscriptions = useCallback(
    (eventTypes: string[]) => {
      if (!robotId) throw new Error('No robot selected');
      return mutate(() =>
        api.put<SubscriptionChangeResult>(`/api/subscriptions/robot/${robotId}`, { eventTypes }),
      );
    },
    [robotId, mutate],
  );

  return {
    data,
    loading,
    error,
    refetch: fetchSubscriptions,
    subscribe,
    unsubscribe,
    saveSubscriptions,
    mutating,
  };
}

// ── Hook: Stable Overview (shared store) ─────────────────────────────

export interface UseStableOverviewReturn {
  data: StableOverview | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStableOverview(): UseStableOverviewReturn {
  const data = useSubscriptionStore((s) => s.overview);
  const loading = useSubscriptionStore((s) => s.loading);
  const error = useSubscriptionStore((s) => s.error);
  const fetchOverview = useSubscriptionStore((s) => s.fetchOverview);
  const refresh = useSubscriptionStore((s) => s.refresh);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { data, loading, error, refetch: refresh };
}

/** Save one robot's whole subscription set, then refresh the shared overview. */
export async function saveRobotSubscriptions(
  robotId: number,
  eventTypes: string[],
): Promise<SubscriptionChangeResult> {
  const result = await api.put<SubscriptionChangeResult>(
    `/api/subscriptions/robot/${robotId}`,
    { eventTypes },
  );
  await useSubscriptionStore.getState().refresh();
  return result;
}

// ── Hook: Event Registry ─────────────────────────────────────────────

export interface UseEventRegistryReturn {
  events: EligibleEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEventRegistry(): UseEventRegistryReturn {
  const [events, setEvents] = useState<EligibleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<RegistryResponse>('/api/subscriptions/registry');
      setEvents(response.events);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load event registry';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  return { events, loading, error, refetch: fetchRegistry };
}
