import { api } from './api';
import type { BattleLogResponse, TeamBattleLog } from '@shared/types';

// Re-export formatters from their new home for backwards compatibility.
// New code should import directly from './battleFormatters'.
export {
  getBattleOutcome,
  getBattlePerspective,
  getELOChange,
  formatDateTime,
  formatDuration,
  getTournamentRoundName,
  getBattleReward,
  getBattleEconomicDisplay,
  isTeamBattleType,
} from './battleFormatters';
export type { BattlePerspective, BattleEconomicDisplay } from './battleFormatters';

// Types
export type ByeRewardStatus = 'expected' | 'awarded' | 'pending';

export interface ScheduledMatch {
  id: number | string; // Can be number for league or "tournament-X" string for tournaments or "tag-team-X" for tag teams
  matchType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth' | 'grand_melee' | 'league_2v2' | 'league_3v3' | 'tournament_2v2' | 'tournament_3v3';
  tournamentId?: number;
  tournamentName?: string;
  tournamentRound?: number;
  currentRound?: number;
  maxRounds?: number;
  robot1Id?: number;
  robot2Id?: number;
  isByeMatch?: boolean;
  byeRewardCredits?: number | null;
  byeRewardStatus?: ByeRewardStatus;
  team1Id?: number;
  team2Id?: number;
  tagTeamLeague?: string;
  leagueType: string;
  scheduledFor: string;
  status: string;
  robot1?: {
    id: number;
    name: string;
    elo: number;
    currentHP: number;
    maxHP: number;
    userId: number;
    user: {
      username: string;
    };
  } | null;
  robot2?: {
    id: number;
    name: string;
    elo: number;
    currentHP: number;
    maxHP: number;
    userId: number;
    user: {
      username: string;
    };
  } | null;
  team1?: {
    id: number;
    activeRobot: {
      id: number;
      name: string;
      elo: number;
      currentHP: number;
      maxHP: number;
      userId: number;
      user: {
        username: string;
      };
    };
    reserveRobot: {
      id: number;
      name: string;
      elo: number;
      currentHP: number;
      maxHP: number;
      userId: number;
      user: {
        username: string;
      };
    };
    combinedELO: number;
  };
  team2?: {
    id: number;
    activeRobot: {
      id: number;
      name: string;
      elo: number;
      currentHP: number;
      maxHP: number;
      userId: number;
      user: {
        username: string;
      };
    };
    reserveRobot: {
      id: number;
      name: string;
      elo: number;
      currentHP: number;
      maxHP: number;
      userId: number;
      user: {
        username: string;
      };
    };
    combinedELO: number;
  };
  // KotH specific fields
  kothParticipantCount?: number;
  kothParticipants?: Array<{ id: number; name: string; elo: number; userId?: number; user?: { username: string } }>;
  // Team Battle specific fields
  teamSize?: number;
  teamBattleLeague?: string;
  teamBattleTeam1?: {
    id: number;
    teamName: string;
    teamSize: number;
    teamLp: number;
    teamLeague: string;
    members: Array<{ robotId: number; robotName: string; robotElo: number; userId: number; user: { username: string } }>;
    combinedELO: number;
  };
  teamBattleTeam2?: {
    id: number;
    teamName: string;
    teamSize: number;
    teamLp: number;
    teamLeague: string;
    members: Array<{ robotId: number; robotName: string; robotElo: number; userId: number; user: { username: string } }>;
    combinedELO: number;
  } | null;
}

export interface BattleParticipantData {
  robotId: number;
  team: number;
  role: string | null;
  eloBefore: number;
  eloAfter: number;
  finalHP: number;
  credits: number;
  streamingRevenue: number;
  prestigeAwarded: number;
  fameAwarded: number;
  damageDealt: number;
  placement: number | null;
  yielded: boolean;
  destroyed: boolean;
  robot: {
    id: number;
    name: string;
    userId: number;
    user: { username: string };
  };
}

export interface BattleHistory {
  id: number;
  robot1Id: number;
  robot2Id: number | null;
  winnerId: number | null;
  createdAt: string;
  durationSeconds: number;
  robot1ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOBefore: number;
  robot2ELOAfter: number;
  robot1FinalHP: number;
  robot2FinalHP: number;
  winnerReward: number;
  loserReward: number;
  battleType?: string; // "league_1v1", "tournament_1v1", "tag_team", "koth", or "grand_melee"
  leagueType?: string; // League at time of battle: "bronze", "silver", "gold", etc.
  tournamentId?: number | null;
  tournamentRound?: number | null;
  tournamentName?: string | null;
  tournamentMaxRounds?: number | null;
  // KotH specific fields
  kothPlacement?: number;
  kothParticipantCount?: number;
  kothZoneScore?: number;
  // Tag team specific fields
  team1Id?: number | null;
  team2Id?: number | null;
  team1StableName?: string | null;
  team2StableName?: string | null;
  team1ActiveRobotId?: number | null;
  team1ReserveRobotId?: number | null;
  team2ActiveRobotId?: number | null;
  team2ReserveRobotId?: number | null;
  team1ActiveRobotName?: string | null;
  team1ReserveRobotName?: string | null;
  team2ActiveRobotName?: string | null;
  team2ReserveRobotName?: string | null;
  team1TagOutTime?: number | null;
  team2TagOutTime?: number | null;
  // Bye match indicator
  isByeMatch?: boolean;
  byeRewardCredits?: number | null;
  byeRewardStatus?: ByeRewardStatus;
  // Forfeits: true when no battle was fought because a side had no main weapon.
  // A fought KotH / Grand Melee battle has isForfeit false but still lists its
  // forfeiters (placed last) in forfeitedRobotIds.
  isForfeit?: boolean;
  forfeitedRobotIds?: number[];
  // Economic fields (from BattleParticipant for the requesting user's robot)
  prestigeAwarded?: number;
  fameAwarded?: number;
  streamingRevenue?: number;
  // Winning side for team battles (1 = team 1, 2 = team 2, null = draw or 1v1)
  winningSide?: number | null;
  // Full participants array — canonical source of per-robot battle data
  participants?: BattleParticipantData[];
  robot1: {
    id: number;
    name: string;
    userId: number;
    currentLeague?: string;
    leagueId?: string;
    user: {
      username: string;
    };
  };
  robot2: {
    id: number;
    name: string;
    userId: number;
    currentLeague?: string;
    leagueId?: string;
    user: {
      username: string;
    };
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// API Functions
export const getUpcomingMatches = async (robotId?: number, signal?: AbortSignal): Promise<ScheduledMatch[]> => {
  const config = {
    ...(robotId ? { params: { robotId } } : {}),
    ...(signal ? { signal } : {}),
  };
  const response = await api.get<{ matches: ScheduledMatch[] }>(
    '/api/matches/upcoming',
    Object.keys(config).length > 0 ? config : undefined,
  );
  return response.matches || [];  // Extract matches array from response
};

export const getMatchHistory = async (
  page: number = 1,
  pageSize: number = 10,
  battleType?: 'overall' | 'league' | 'tournament' | 'tag_team' | 'koth' | 'grand_melee' | 'league_2v2' | 'league_3v3' | 'tournament_2v2' | 'tournament_3v3',
  robotId?: number,
  signal?: AbortSignal,
): Promise<PaginatedResponse<BattleHistory>> => {
  const params: { page: number; perPage: number; battleType?: string; robotId?: number } = { page, perPage: pageSize };
  
  // Add battleType filter if not 'overall'
  if (battleType && battleType !== 'overall') {
    params.battleType = battleType;
  }

  // Add robotId filter to fetch battles for a specific robot
  if (robotId) {
    params.robotId = robotId;
  }
  
  return api.get<PaginatedResponse<BattleHistory>>('/api/matches/history', signal ? { params, signal } : { params });
};

// Re-export tier helpers from single source of truth
export { getTierName as getLeagueTierName, getTierColor as getLeagueTierColor, getTierIcon as getLeagueTierIcon } from './tierHelpers';

// Battle log: the response shape is the wire contract in `@shared/types`
// (battle-log.ts), shared with backend `services/match/battleLogService.ts`.

/** Whether a stored battle log is a team battle log (`teamBattle: true`). */
export function isTeamBattleLog(log: unknown): log is TeamBattleLog {
  return typeof log === 'object' && log !== null && (log as { teamBattle?: unknown }).teamBattle === true;
}

export const getBattleLog = async (battleId: number, signal?: AbortSignal): Promise<BattleLogResponse> => {
  const url = `/api/matches/battles/${battleId}/log`;
  return signal ? api.get<BattleLogResponse>(url, { signal }) : api.get<BattleLogResponse>(url);
};
