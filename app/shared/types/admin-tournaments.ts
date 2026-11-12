/**
 * Wire contract for the admin Tournaments page: `GET /api/admin/tournaments/overview`
 * (backend `services/admin/tournaments`). Tournaments run one round per daily
 * cycle; the table is emptied at season rollover, so every row is this season.
 */
import type { StableType } from './stable';

/** `TOURNAMENT_TYPES` in backend `tournamentOverviewTypes.ts` satisfies it. */
export type TournamentType = 'robot' | 'team_2v2' | 'team_3v3';

export type CurrentStatusReason = 'stalled' | 'left_behind' | 'paused';

export interface CurrentTournament {
  id: number;
  name: string;
  round: number;
  maxRounds: number;
  /** "Final", "Semi-finals", "Quarter-finals", "Round of 32". */
  stage: string;
  participants: number;
  startedAt: string | null;
  /** Date (UTC) the final is expected to run, assuming one round per daily cycle. */
  expectedFinish: string | null;
  /** Next run of the type's job (UTC), or null when its schedule is not daily. */
  nextRunAt: string | null;
  currentRound: { matches: number; done: number };
  firstRound: { matches: number; byes: number };
  /** Matches of earlier rounds still pending or scheduled. */
  leftBehind: number;
  /** Last finished match, or the start when none has finished. */
  lastProgressAt: string | null;
  status: { level: 'ok' | 'warning' | 'info'; reasons: CurrentStatusReason[] };
}

export interface ChampionEntry {
  tournamentId: number;
  name: string;
  completedAt: string | null;
  champion: string | null;
  stableId: number | null;
  stableName: string | null;
  stableType: StableType | null;
}

export interface ChampionStable {
  stableId: number | null;
  stableName: string | null;
  titles: number;
}

export interface TournamentTypeSeason {
  completed: number;
  /** Average rounds (= days) of the completed tournaments, one decimal; null without any. */
  averageDays: number | null;
  /** Participants per tournament, oldest first, the current one last. */
  sizes: { tournamentId: number; participants: number; current: boolean }[];
  championsByStableType: { human: number; automaton: number; generated: number; unknown: number };
  championStables: ChampionStable[];
  recentChampions: ChampionEntry[];
  /** The top stable when it holds more than the dominance share of titles. */
  dominantStable: ChampionStable | null;
}

export interface TournamentTypeOverview {
  type: TournamentType;
  /** Daily job time, "HH:MM" UTC, or null for a non-daily schedule. */
  jobTime: string | null;
  current: CurrentTournament | null;
  season: TournamentTypeSeason;
}

export interface TournamentOverview {
  generatedAt: string;
  seasonPhase: string | null;
  thresholds: { stalledAfterHours: number; dominanceShare: number; dominanceMinCompleted: number };
  types: TournamentTypeOverview[];
}
