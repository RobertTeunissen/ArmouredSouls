/**
 * Admin Practice Arena API (`/admin/practice-arena`): usage recorded per
 * request in `practice_arena_events`, by UTC day.
 */
import { api } from './api';
import type { PracticeArenaOverview } from '@shared/types';

export function getPracticeArenaOverview(signal?: AbortSignal): Promise<PracticeArenaOverview> {
  return api.get<PracticeArenaOverview>('/api/admin/practice-arena/overview', { signal });
}
