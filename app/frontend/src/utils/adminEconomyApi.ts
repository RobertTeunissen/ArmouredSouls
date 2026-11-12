/**
 * Typed API of the admin Economy page (`/admin/economy`).
 * Mirrors `app/backend/src/services/admin/adminEconomyService.ts`.
 */
import { api } from './api';
import type { EconomyResponse, EconomyStableScope, EconomyWindow } from '@shared/types';

export const getEconomyOverview = (
  stables: EconomyStableScope,
  window: EconomyWindow,
  options: { fresh?: boolean; signal?: AbortSignal } = {},
): Promise<EconomyResponse> =>
  api.get<EconomyResponse>('/api/admin/economy', {
    params: { stables, window, ...(options.fresh ? { fresh: 'true' } : {}) },
    signal: options.signal,
  });
