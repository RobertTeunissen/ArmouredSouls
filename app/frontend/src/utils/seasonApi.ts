/**
 * Season API client (Spec #45).
 *
 * Every displayed cycle value comes from these endpoints — nothing is computed
 * client-side from timestamps or a cycle counter, so a clock difference between
 * browser and server can never shift what a player reads.
 */

import { api } from './api';

/** Current season state, as returned by `GET /api/seasons/current`. */
export interface SeasonState {
  seasonNumber: number;
  phase: 'preparation' | 'competitive' | 'completed';
  /** 1-based cycle within the competitive phase; 0 while preparing. */
  seasonCycle: number;
  seasonLengthCycles: number;
  remainingCompetitiveCycles: number;
  /** 1-based preparation day; 0 while competitive. */
  preparationDay: number;
  remainingPreparationCycles: number;
  /** True only for season 0, the legacy pre-season-system timeline. */
  isLegacy: boolean;
}

export interface BestTier {
  tier: string;
  mode: string;
}

/** One collapsed row of a stable's season history. */
export interface StableSeasonSummary {
  seasonNumber: number;
  isLegacy: boolean;
  competitiveCycles: number;
  finalCredits: number;
  prestigeEarned: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  championshipTitles: number;
  achievementsUnlocked: number;
  achievementsAvailable: number;
  robotCount: number;
  teamCount: number;
  bestTier: BestTier | null;
}

export interface ArchivedStanding {
  mode: string;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  bestWinStreak: number;
  instanceRank: number;
}

export interface ArchivedTeamMembership {
  teamName: string;
  teamSize: number;
  modes: Array<{
    mode: string;
    tier: string;
    leagueInstanceId: string;
    leaguePoints: number;
    instanceRank: number;
  }>;
}

export interface ArchivedRobot {
  robotName: string;
  imageUrl: string | null;
  frameId: number;
  paintJob: string | null;
  finalElo: number;
  fame: number;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  kills: number;
  mainWeaponName: string | null;
  offhandWeaponName: string | null;
  standings: ArchivedStanding[];
  teams: ArchivedTeamMembership[];
}

export interface ArchivedAccolade {
  category: string;
  rank: number;
  subjectName: string;
  value: number;
  valueLabel: string;
  mode: string | null;
}

export interface StableSeasonDetail extends StableSeasonSummary {
  stableName: string;
  highestElo: number;
  totalFame: number;
  facilities: Array<{ facilityType: string; level: number }>;
  achievementIds: string[];
  robots: ArchivedRobot[];
  accolades: ArchivedAccolade[];
}

/** One entry in the global season list on the archive page. */
export interface SeasonListEntry {
  seasonNumber: number;
  isLegacy: boolean;
  competitiveCycles: number;
  startedAt: string;
  endedAt: string | null;
  humanStableCount: number;
  generatedStableCount: number;
}

export interface SnapshotEntry {
  tier: string;
  leagueInstanceId: string;
  instanceRank: number;
  entityType: string;
  entityName: string;
  stableName: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  isGeneratedSubject: boolean;
}

export interface SeasonDetail {
  seasonNumber: number;
  isLegacy: boolean;
  competitiveCycles: number;
  startedAt: string;
  endedAt: string | null;
  humanStableCount: number;
  generatedStableCount: number;
  standingsByMode: Record<string, SnapshotEntry[]>;
  accolades: Array<ArchivedAccolade & { stableName: string; isGeneratedSubject: boolean }>;
}

/** Payload of the once-per-season summary modal. */
export interface SeasonSummary {
  seasonNumber: number;
  isLegacy: boolean;
  finalCredits: number;
  prestigeEarned: number;
  wins: number;
  losses: number;
  draws: number;
  achievementsUnlocked: number;
  achievementsAvailable: number;
  bestTier: BestTier | null;
  accolades: Array<{
    category: string;
    rank: number;
    subjectName: string;
    valueLabel: string;
    value: number;
  }>;
}

export const getCurrentSeason = (): Promise<SeasonState> =>
  api.get<SeasonState>('/api/seasons/current');

export const listSeasons = (): Promise<SeasonListEntry[]> =>
  api.get<SeasonListEntry[]>('/api/seasons');

export const getSeasonDetail = (seasonNumber: number): Promise<SeasonDetail> =>
  api.get<SeasonDetail>(`/api/seasons/${seasonNumber}`);

export const getStableSeasonHistory = (userId: number): Promise<StableSeasonSummary[]> =>
  api.get<StableSeasonSummary[]>(`/api/seasons/stables/${userId}`);

export const getStableSeasonDetail = (
  userId: number,
  seasonNumber: number,
): Promise<StableSeasonDetail> =>
  api.get<StableSeasonDetail>(`/api/seasons/stables/${userId}/${seasonNumber}`);

export const getSeasonSummary = (): Promise<SeasonSummary | null> =>
  api.get<SeasonSummary | null>('/api/seasons/summary');

export const markSeasonSummarySeen = (seasonNumber: number): Promise<void> =>
  api.post<void>('/api/seasons/summary-seen', { seasonNumber });

// ─── Admin season management (Spec #45) ──────────────────────────────
//
// These endpoints are admin-only. They power the Admin_Season_Portal page,
// which is the only in-app way to close Season_Zero and to nudge the current
// season's phase for testing.

/** Config echoed back by the admin state endpoint (from server env). */
export interface AdminSeasonConfig {
  seasonLengthCycles: number;
  preparationLengthCycles: number;
  countdownCycles: number;
  accoladeDepth: number;
  retainedImagesPerStable: number;
}

/** Admin view of the current season — the player state plus operational flags. */
export interface AdminSeasonState extends SeasonState {
  /** True while a rollover is executing; the trigger button must stay disabled. */
  rolloverInProgress: boolean;
  /** True only during a preparation window, when balance changes are appropriate. */
  balanceChangesAppropriate: boolean;
  config: AdminSeasonConfig;
}

/** Read-only projection of what a rollover would archive, delete, and purge. */
export interface RolloverPreview {
  humanStables: number;
  humanRobots: number;
  generatedStables: number;
  generatedRobots: number;
  rowsToPurge: Record<string, number>;
  imagesRetained: number;
  imagesDeleted: number;
}

/** Summary returned after a rollover completes. */
export interface RolloverResult {
  completedSeasonNumber: number;
  newSeasonNumber: number;
  stablesArchived: number;
  robotsArchived: number;
  snapshotRows: number;
  accoladeRows: number;
  generatedStablesDeleted: number;
  totalRowsPurged: number;
  durations: { archiveMs: number; purgeMs: number; postMs: number; totalMs: number };
}

export const getAdminSeasonState = (): Promise<AdminSeasonState> =>
  api.get<AdminSeasonState>('/api/admin/seasons/state');

export const getRolloverPreview = (): Promise<RolloverPreview> =>
  api.get<RolloverPreview>('/api/admin/seasons/rollover-preview');

/**
 * Execute a rollover now. The confirmation phrase and season number are fixed
 * server-side guards — the number must match the current season or the request
 * is rejected with a 400.
 */
export const executeRollover = (seasonNumber: number): Promise<RolloverResult> =>
  api.post<RolloverResult>('/api/admin/seasons/rollover', {
    confirm: 'CONFIRM_ROLLOVER',
    seasonNumber,
  });

export const extendSeason = (additionalCycles: number): Promise<SeasonState> =>
  api.post<SeasonState>('/api/admin/seasons/extend', { additionalCycles });

export const setPreparationCycles = (remainingCycles: number): Promise<SeasonState> =>
  api.post<SeasonState>('/api/admin/seasons/preparation-cycles', { remainingCycles });
