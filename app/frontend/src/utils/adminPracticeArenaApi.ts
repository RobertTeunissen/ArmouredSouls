/**
 * Admin Practice Arena API (`/admin/practice-arena`): usage recorded per
 * request in `practice_arena_events`, by UTC day.
 */
import { api } from './api';

export type PracticeMatchup = 'owned_vs_sparring' | 'owned_vs_owned' | 'sparring_vs_sparring';

export interface PracticeDayStats {
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  battles: number;
  /** Requests that ran battles. */
  requests: number;
  players: number;
  rateLimited: number;
  cycleBusy: number;
  /** Time a scheduler job held the lock; null before run history existed. */
  unavailableMs: number | null;
  /** False before recording started this season: no data rather than zero. */
  recorded: boolean;
}

export interface PracticeUsage {
  battles: number;
  requests: number;
  matchups: Record<PracticeMatchup, number>;
  botTiers: Record<string, number>;
  batchSizes: { single: number; small: number; large: number };
  overridesRequests: number;
}

export interface PracticeArenaOverview {
  timestamp: string;
  windowDays: number;
  recordingSince: string | null;
  season: { number: number | null; battles: number; players: number };
  /** Newest (today) first. */
  days: PracticeDayStats[];
  topPractitioners: Array<{ userId: number; username: string; stableName: string | null; battles: number; lastPracticeAt: string | null }>;
  usage: PracticeUsage;
}

export function getPracticeArenaOverview(signal?: AbortSignal): Promise<PracticeArenaOverview> {
  return api.get<PracticeArenaOverview>('/api/admin/practice-arena/overview', { signal });
}
