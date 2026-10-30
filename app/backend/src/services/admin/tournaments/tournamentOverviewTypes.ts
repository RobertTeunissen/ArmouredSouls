/**
 * Response shape of `GET /api/admin/tournaments/overview` and the rows it is
 * built from.
 *
 * Tournaments run one round per daily cycle (one job per type). The table is
 * emptied at season rollover, so every row is this season.
 *
 * @module services/admin/tournaments/tournamentOverviewTypes
 */

export const TOURNAMENT_TYPES = ['robot', 'team_2v2', 'team_3v3'] as const;
export type TournamentType = typeof TOURNAMENT_TYPES[number];

export type StableType = 'human' | 'generated' | 'automaton';

/** One `tournaments` row with its champion (when completed). */
export interface TournamentRow {
  id: number;
  name: string;
  type: TournamentType;
  status: string;
  currentRound: number;
  maxRounds: number;
  totalParticipants: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  champion: {
    id: number;
    name: string | null;
    stableId: number | null;
    stableName: string | null;
    stableType: StableType | null;
  } | null;
}

/** `tournament_matches` of one running tournament, grouped. */
export interface MatchGroupRow {
  tournamentId: number;
  round: number;
  status: string;
  isBye: boolean;
  count: number;
  lastCompletedAt: Date | null;
}

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
