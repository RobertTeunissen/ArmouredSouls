/**
 * useSubscriptions hook
 *
 * Data fetching hook for robot subscriptions, stable overview, and event registry.
 * Exposes subscribe/unsubscribe mutation functions with loading/error states.
 *
 * Requirements: R9.2, R9.10
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';

// ── Types ────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  robotId: number;
  eventType: string;
  status: 'active' | 'pending';
  createdAt: string;
}

export interface RobotSubscriptionInfo {
  subscriptions: Subscription[];
  cap: number;
  level: number;
}

export interface StableOverviewRobot {
  robotId: number;
  robotName: string;
  subscriptions: { eventType: string; status: 'active' | 'pending' }[];
  cap: number;
}

export interface StableOverview {
  robots: StableOverviewRobot[];
  registeredEvents: { type: string; label: string }[];
  bookingOfficeLevel: number;
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

interface MutationResponse {
  success: boolean;
  message: string;
}

// ── Hook: Robot Subscriptions ────────────────────────────────────────

export interface UseRobotSubscriptionsReturn {
  data: RobotSubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  subscribe: (eventType: string) => Promise<MutationResponse>;
  unsubscribe: (eventType: string) => Promise<MutationResponse>;
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

  const subscribe = useCallback(
    async (eventType: string): Promise<MutationResponse> => {
      if (!robotId) throw new Error('No robot selected');
      setMutating(true);
      try {
        const result = await api.post<MutationResponse>(
          `/api/subscriptions/robot/${robotId}/subscribe`,
          { eventType },
        );
        await fetchSubscriptions();
        return result;
      } finally {
        setMutating(false);
      }
    },
    [robotId, fetchSubscriptions],
  );

  const unsubscribe = useCallback(
    async (eventType: string): Promise<MutationResponse> => {
      if (!robotId) throw new Error('No robot selected');
      setMutating(true);
      try {
        const result = await api.post<MutationResponse>(
          `/api/subscriptions/robot/${robotId}/unsubscribe`,
          { eventType },
        );
        await fetchSubscriptions();
        return result;
      } finally {
        setMutating(false);
      }
    },
    [robotId, fetchSubscriptions],
  );

  return { data, loading, error, refetch: fetchSubscriptions, subscribe, unsubscribe, mutating };
}

// ── Hook: Stable Overview ────────────────────────────────────────────

export interface UseStableOverviewReturn {
  data: StableOverview | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStableOverview(): UseStableOverviewReturn {
  const [data, setData] = useState<StableOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await api.get<StableOverview>('/api/subscriptions/overview');
      setData(overview);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load subscription overview';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { data, loading, error, refetch: fetchOverview };
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
