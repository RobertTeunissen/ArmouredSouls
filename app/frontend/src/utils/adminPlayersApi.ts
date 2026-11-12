/**
 * Typed API of the admin Players page (`/admin/players`) and its stable
 * detail panel. Mirrors `app/backend/src/services/admin/adminPlayersService.ts`
 * and `stableCashflow.ts`.
 */
import { api } from './api';
import type { AdminStableSearchResult, PlayerDetail, PlayersOverview } from '@shared/types';

export const getPlayersOverview = (signal?: AbortSignal): Promise<PlayersOverview> =>
  api.get<PlayersOverview>('/api/admin/players', { signal });

export const getPlayerDetail = (userId: number, signal?: AbortSignal): Promise<PlayerDetail> =>
  api.get<PlayerDetail>(`/api/admin/users/${userId}`, { signal });

export const searchStables = async (q: string, signal?: AbortSignal): Promise<AdminStableSearchResult[]> =>
  (await api.get<{ users: AdminStableSearchResult[] }>('/api/admin/users/search', { params: { q }, signal })).users;

export const resetPlayerPassword = (userId: number, password: string): Promise<{ success: boolean; username: string }> =>
  api.post<{ success: boolean; username: string }>(`/api/admin/users/${userId}/reset-password`, { password });
