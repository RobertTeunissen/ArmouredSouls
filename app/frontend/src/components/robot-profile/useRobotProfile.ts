import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';
import type { RobotProfile } from '@shared/types';

const log = createLogger('useRobotProfile');

export interface RobotProfileState {
  /** Null while loading or when the request failed. */
  profile: RobotProfile | null;
  failed: boolean;
  /** Requests the profile again (after a failure). */
  reload: () => void;
}

/** The public profile sections for one robot. */
export function useRobotProfile(robotId: number | undefined): RobotProfileState {
  const [profile, setProfile] = useState<RobotProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!robotId) return undefined;
    let cancelled = false;
    setProfile(null);
    setFailed(false);
    api.get<RobotProfile>(`/api/robots/${robotId}/profile`)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((error: unknown) => {
        log.error('Failed to load robot profile', error);
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [robotId, attempt]);

  return { profile, failed, reload };
}
