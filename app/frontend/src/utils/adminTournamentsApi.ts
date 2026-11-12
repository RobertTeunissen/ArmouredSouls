/**
 * Typed API of the admin Tournaments page (`/admin/tournaments`).
 *
 * The response shape is a wire contract in `@shared/types` (admin-tournaments.ts).
 */
import { api } from './api';
import type { TournamentOverview } from '@shared/types';

export function getTournamentOverview(signal?: AbortSignal): Promise<TournamentOverview> {
  return api.get<TournamentOverview>('/api/admin/tournaments/overview', { signal });
}
