/**
 * useSubscriptions hooks
 *
 * Data fetching for the stable overview and the event registry, plus the
 * whole-set save behind the subscription matrix.
 *
 * `useStableOverview` is a thin wrapper over `useSubscriptionStore` so that every
 * component asking for the overview shares one request. It keeps the original
 * `{ data, loading, error, refetch }` shape, so existing callers did not change.
 *
 * Requirements: R9.2, R9.10
 */

import { useEffect } from 'react';
import { api } from '../utils/api';
import { apiErrorMessage } from '../utils/ApiError';
import { useApiQuery } from './useApiQuery';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import type {
  EligibleEvent,
  RegistryResponse,
  StableOverview,
  SubscriptionChangeResponse,
} from '@shared/types';

// ── Types ────────────────────────────────────────────────────────────

/** Shape of the `details` payload on a SUBSCRIPTION_CAP_EXCEEDED error. */
export interface CapExceededDetails {
  currentCount: number;
  requestedCount?: number;
  cap: number;
  level: number;
  heldSlots?: string[];
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
): Promise<SubscriptionChangeResponse> {
  const result = await api.put<SubscriptionChangeResponse>(
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
  refetch: () => void;
}

export function useEventRegistry(): UseEventRegistryReturn {
  const query = useApiQuery(
    (signal) => api.get<RegistryResponse>('/api/subscriptions/registry', { signal }),
    [],
  );
  return {
    events: query.data?.events ?? [],
    loading: query.loading,
    error: apiErrorMessage(query.error, 'Failed to load event registry'),
    refetch: query.refetch,
  };
}
