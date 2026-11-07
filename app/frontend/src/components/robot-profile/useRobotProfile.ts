import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';
import type { PublicRobotStanding, RecentResult } from '../stable-view/types';

const log = createLogger('useRobotProfile');

/** `GET /api/robots/:id/profile` (#504). */
export interface ProfileStanding extends PublicRobotStanding {
  rank: number;
  instanceSize: number;
}

export interface ProfileAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
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

export interface RobotProfileData {
  standings: ProfileStanding[];
  form: RecentResult[];
  achievements: ProfileAchievement[];
  accolades: ProfileAccolade[];
}

/** The public profile sections; null while loading or when the request failed. */
export function useRobotProfile(robotId: number | undefined): { profile: RobotProfileData | null; failed: boolean } {
  const [profile, setProfile] = useState<RobotProfileData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!robotId) return undefined;
    let cancelled = false;
    setProfile(null);
    setFailed(false);
    api.get<RobotProfileData>(`/api/robots/${robotId}/profile`)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((error: unknown) => {
        log.error('Failed to load robot profile', error);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [robotId]);

  return { profile, failed };
}
