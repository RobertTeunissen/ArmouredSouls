/**
 * Typed API of the admin Tournaments page (`/admin/tournaments`).
 *
 * Mirrors `app/backend/src/services/admin/tournaments/tournamentOverviewTypes.ts`.
 */
import { api } from './api';

export type TournamentType = 'robot' | 'team_2v2' | 'team_3v3';
export type StableType = 'human' | 'generated' | 'automaton';
export type CurrentStatusReason = 'stalled' | 'left_behind' | 'paused';

export interface CurrentTournament {
  id: number;
  name: string;
  round: number;
  maxRounds: number;
  stage: string;
  participants: number;
  startedAt: string | null;
  /** UTC date (YYYY-MM-DD) the final is expected to run. */
  expectedFinish: string | null;
  nextRunAt: string | null;
  currentRound: { matches: number; done: number };
  firstRound: { matches: number; byes: number };
  leftBehind: number;
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
  averageDays: number | null;
  sizes: { tournamentId: number; participants: number; current: boolean }[];
  championsByStableType: { human: number; automaton: number; generated: number; unknown: number };
  championStables: ChampionStable[];
  recentChampions: ChampionEntry[];
  dominantStable: ChampionStable | null;
}

export interface TournamentTypeOverview {
  type: TournamentType;
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

export function getTournamentOverview(signal?: AbortSignal): Promise<TournamentOverview> {
  return api.get<TournamentOverview>('/api/admin/tournaments/overview', { signal });
}
