/**
 * Rows `GET /api/admin/tournaments/overview` is built from; the response
 * shape is a wire contract in `src/shared/types` (admin-tournaments.ts).
 *
 * Tournaments run one round per daily cycle (one job per type). The table is
 * emptied at season rollover, so every row is this season.
 *
 * @module services/admin/tournaments/tournamentOverviewTypes
 */
import type { StableType, TournamentType } from '../../../shared/types';

export const TOURNAMENT_TYPES = ['robot', 'team_2v2', 'team_3v3'] as const satisfies readonly TournamentType[];

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
