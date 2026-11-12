/**
 * Accepted stable scopes of `GET /api/admin/achievements/analytics`; the
 * response shape is a wire contract in `src/shared/types` (admin-achievements.ts).
 */
import type { AchievementStableScope } from '../../../shared/types';

/** The stable types the Achievements page can show. */
export const ACHIEVEMENT_STABLE_SCOPES = ['players', 'automatons', 'generated'] as const satisfies readonly AchievementStableScope[];
