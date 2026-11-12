/**
 * Typed API of the admin Achievements page (`/admin/achievements`).
 * The response shape is a wire contract in `@shared/types` (admin-achievements.ts).
 */
import { api } from './api';
import type { AchievementAnalytics, AchievementStableScope } from '@shared/types';

export const ACHIEVEMENT_STABLES = ['players', 'automatons', 'generated'] as const satisfies readonly AchievementStableScope[];
export function getAchievementAnalytics(stables: AchievementStableScope, signal?: AbortSignal): Promise<AchievementAnalytics> {
  return api.get<AchievementAnalytics>('/api/admin/achievements/analytics', { params: { stables }, signal });
}
