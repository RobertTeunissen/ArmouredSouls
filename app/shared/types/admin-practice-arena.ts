/**
 * Wire contract for the admin Practice Arena page: `GET /api/admin/practice-arena/overview`
 * (backend `services/practice-arena/practiceArenaUsageService.ts`).
 */

// ─── Overview (DB) ───────────────────────────────────────────────────

export interface PracticeArenaOverview {
  timestamp: string;
  windowDays: number;
  /** When events started being recorded for this season (later of the migration and season start). */
  recordingSince: string | null;
  season: { number: number | null; battles: number; players: number };
  /** Newest (today) first. */
  days: PracticeDayStats[];
  topPractitioners: Array<{
    userId: number;
    username: string;
    stableName: string | null;
    battles: number;
    /** Latest recorded battle; null when all of it predates recording. */
    lastPracticeAt: string | null;
  }>;
  usage: PracticeUsage;
}

export interface PracticeDayStats {
  /** "YYYY-MM-DD" (UTC). */
  date: string;
  battles: number;
  /** Requests that ran battles. */
  requests: number;
  /** Players who ran at least one battle. */
  players: number;
  rateLimited: number;
  cycleBusy: number;
  /** Time a scheduler job held the lock (practice refused); null before run history. */
  unavailableMs: number | null;
  /** False for days before recording started (or before this season): no data, not zero. */
  recorded: boolean;
}

export type PracticeMatchup = 'owned_vs_sparring' | 'owned_vs_owned' | 'sparring_vs_sparring';

export interface PracticeUsage {
  battles: number;
  requests: number;
  /** Battles per matchup. */
  matchups: Record<PracticeMatchup, number>;
  /** Battles per sparring-partner tier (requests with a sparring partner). */
  botTiers: Record<string, number>;
  /** Requests by batch size. */
  batchSizes: { single: number; small: number; large: number };
  /** Requests where an owned robot carried what-if overrides. */
  overridesRequests: number;
}
