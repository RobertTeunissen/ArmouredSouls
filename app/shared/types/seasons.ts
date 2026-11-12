/**
 * Wire contracts for seasons: the player season state, Season Archive and
 * stable season history (`/api/seasons/*`) and the admin Season Control page
 * (`/api/admin/season/*`; backend `services/season`).
 */
import type { RolloverRunSummary, RolloverStageName, RolloverStageProgress } from './admin-scheduler';
import type { StableType } from './stable';

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
  /** Spec #55: Stable_Type of the subject's stable (drives the Automaton_Badge). */
  subjectStableType?: StableType;
  modeRank: number;
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
  accolades: Array<ArchivedAccolade & { stableName: string; isGeneratedSubject: boolean; subjectStableType?: StableType }>;
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

/** Config echoed back by the admin state endpoint (from server env). */
export interface AdminSeasonConfig {
  seasonLengthCycles: number;
  preparationLengthCycles: number;
  countdownCycles: number;
  accoladeDepth: number;
  retainedImagesPerStable: number;
}

/** The rollover queued or executing right now. */
export interface AdminActiveRollover {
  runId: number | null;
  status: 'queued' | 'running';
  /** `manual` (admin) or `cron` (settlement). */
  trigger: 'manual' | 'cron';
  triggeredBy: { userId: number; username: string | null } | null;
  queuedAt: string | null;
  startedAt: string | null;
  progress: RolloverRunSummary | null;
}

/** Admin view of the current season — the player state plus operational flags. */
export interface AdminSeasonState extends SeasonState {
  /** True while a rollover is queued or executing; the trigger button must stay disabled. */
  rolloverInProgress: boolean;
  /** True only during a preparation window, when balance changes are appropriate. */
  balanceChangesAppropriate: boolean;
  config: AdminSeasonConfig;
  /** When the current season opened. */
  startedAt: string | null;
  /** The scheduler's next settlement, or null when automated scheduling is off. */
  nextSettlementAt: string | null;
  activeRollover: AdminActiveRollover | null;
}

export interface StableTypeCounts {
  stables: number;
  robots: number;
}

/** Read-only projection of what a rollover would archive, delete, and purge. */
export interface RolloverPreview {
  /** Every non-generated stable (human players and Automatons). */
  humanStables: number;
  humanRobots: number;
  generatedStables: number;
  generatedRobots: number;
  breakdown: { human: StableTypeCounts; automaton: StableTypeCounts; generated: StableTypeCounts };
  rowsToPurge: Record<string, number>;
  imagesRetained: number;
  imagesDeleted: number;
  /** Human stables with no login this season: archived, then deleted (first 50 names). */
  dormantHumanStables: { count: number; names: string[] };
}

/** One rollover attempt in the history (a run, or a legacy audit row). */
export interface RolloverAttempt {
  source: 'run' | 'audit';
  id: number;
  at: string;
  status: 'success' | 'failed' | 'interrupted';
  trigger: 'manual' | 'cron';
  triggeredBy: { userId: number; username: string | null } | null;
  durationMs: number | null;
  error: string | null;
  failedStage: RolloverStageName | null;
  stages: RolloverStageProgress[] | null;
  result: RolloverRunSummary['result'];
}

export interface SeasonHistoryEntry {
  seasonNumber: number;
  isLegacy: boolean;
  startedAt: string;
  endedAt: string | null;
  competitiveCycles: number;
  humanStableCount: number;
  generatedStableCount: number;
  rollover: RolloverAttempt | null;
  failedAttempts: RolloverAttempt[];
}

export interface SeasonRolloverHistory {
  seasons: SeasonHistoryEntry[];
  currentSeasonAttempts: RolloverAttempt[];
}

/** The queued run returned by a background rollover (202). */
export interface QueuedRolloverRun {
  id: number | null;
  jobName: string;
  status: 'queued';
  queuedAt: string;
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
  /** Absent on rollovers before the dormant purge existed. */
  dormantStablesDeleted?: number;
  totalRowsPurged: number;
  durations: { archiveMs: number; purgeMs: number; postMs: number; totalMs: number };
}
