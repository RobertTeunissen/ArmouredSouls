/**
 * Response shapes of the fame, destructions and prestige leaderboards
 * (`GET /api/leaderboards/*`).
 */
import type { StableType } from './stable';

export interface LeaderboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface FameLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  fame: number;
  fameTier: string;
  stableId: number;
  stableName: string;
  /** Spec #55 R1.7: drives the Automaton_Badge. */
  stableType: StableType;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  damageDealtLifetime: number;
}

/** Battle types the destructions leaderboard splits by. */
export type LeaderboardKillMode =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'koth'
  | 'grand_melee'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3';

/** Columns the destructions leaderboard can be ordered by. */
export type LossesSortKey = 'total' | LeaderboardKillMode;

export interface LossesLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  /** Opponents destroyed, all battle types. */
  totalLosses: number;
  /** Destructions split by battle type. Always carries every tracked mode. */
  killsByMode: Record<LeaderboardKillMode, number>;
  stableId: number;
  stableName: string;
  /** Spec #55 R1.7: drives the Automaton_Badge. */
  stableType: StableType;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  /** Destructions inflicted ÷ losses taken. */
  lossRatio: number;
  damageDealtLifetime: number;
}

export interface PrestigeLeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  stableName: string;
  /** Spec #55 R1.7: drives the Automaton_Badge. */
  stableType: StableType;
  prestige: number;
  prestigeRank: string;
  totalRobots: number;
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  highestELO: number;
  championshipTitles: number;
}

export interface FameLeaderboardResponse {
  leaderboard: FameLeaderboardEntry[];
  pagination: LeaderboardPagination;
  timestamp: string;
}

export interface LossesLeaderboardResponse {
  leaderboard: LossesLeaderboardEntry[];
  pagination: LeaderboardPagination;
  sortBy: LossesSortKey;
  timestamp: string;
}

export interface PrestigeLeaderboardResponse {
  leaderboard: PrestigeLeaderboardEntry[];
  pagination: LeaderboardPagination & { totalStables: number };
  timestamp: string;
}
