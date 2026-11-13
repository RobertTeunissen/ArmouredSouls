/**
 * Wire contract for `GET /api/robots/:id/profile` (public robot profile, #504):
 * per-mode standings with the rank in the league instance, recent form, the
 * robot's achievements and its Hall of Records placements.
 */

import type { PublicRobotStanding, RecentResult } from './stable-view';

export interface ProfileStanding extends PublicRobotStanding {
  /** 1-based position by LP in the league instance; equal LP shares a rank. */
  rank: number;
  /** Competitors in the league instance (same entity type and mode). */
  instanceSize: number;
}

export interface ProfileAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
  /** Human stables holding it (rarity cache); null until the cache has loaded. */
  holders: number | null;
}

export interface ProfileAccolade {
  seasonNumber: number;
  category: string;
  rank: number;
  value: number;
  valueLabel: string;
  mode: string | null;
}

export interface RobotProfile {
  standings: ProfileStanding[];
  form: RecentResult[];
  achievements: ProfileAchievement[];
  accolades: ProfileAccolade[];
}
