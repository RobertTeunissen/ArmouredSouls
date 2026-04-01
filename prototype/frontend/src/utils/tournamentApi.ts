import { api } from './api';
import type { TournamentMatchWithRobots } from './bracketUtils';

// Types

export interface SeedEntry {
  seed: number;
  robotId: number;
  robotName: string;
  elo: number;
  eliminated: boolean;
}

export interface Tournament {
  id: number;
  name: string;
  tournamentType: string;
  status: 'pending' | 'active' | 'completed';
  currentRound: number;
  maxRounds: number;
  totalParticipants: number;
  winnerId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  winner?: {
    id: number;
    name: string;
  };
}

export interface TournamentMatch {
  id: number;
  tournamentId: number;
  round: number;
  matchNumber: number;
  robot1Id: number | null;
  robot2Id: number | null;
  winnerId: number | null;
  battleId: number | null;
  status: 'pending' | 'scheduled' | 'completed';
  isByeMatch: boolean;
  completedAt: string | null;
  robot1?: {
    id: number;
    name: string;
    elo: number;
  };
  robot2?: {
    id: number;
    name: string;
    elo: number;
  };
}

export interface TournamentDetails extends Tournament {
  matches: TournamentMatchWithRobots[];
  currentRoundMatches: TournamentMatchWithRobots[];
  participantCount: number;
  seedings: SeedEntry[];
}

export interface CreateTournamentResponse {
  tournament: Tournament;
  message: string;
}

export interface ExecuteRoundResponse {
  message: string;
  matchesExecuted: number;
  winnersAdvanced: number;
  tournamentCompleted: boolean;
  winnerId?: number;
  winnerName?: string;
}

export interface EligibleRobotsResponse {
  eligibleCount: number;
  totalRobots: number;
  eligibleRobots: Array<{
    id: number;
    name: string;
    elo: number;
    currentHP: number;
    maxHP: number;
    weaponCount: number;
  }>;
}

// API Functions

/**
 * Create a new single elimination tournament
 */
export const createTournament = async (): Promise<CreateTournamentResponse> => {
  return api.post<CreateTournamentResponse>('/api/admin/tournaments/create', {});
};

/**
 * List all tournaments (public endpoint for all authenticated users)
 */
export const listTournaments = async (): Promise<{ tournaments: Tournament[] }> => {
  return api.get<{ tournaments: Tournament[] }>('/api/tournaments');
};

/**
 * Get tournament details by ID (public endpoint for all authenticated users)
 */
export const getTournamentDetails = async (
  tournamentId: number
): Promise<{ tournament: TournamentDetails; seedings: SeedEntry[] }> => {
  const data = await api.get<{ tournament: Tournament & { matches?: TournamentMatchWithRobots[] }; seedings: SeedEntry[] }>(
    `/api/tournaments/${tournamentId}`
  );
  
  // Backend returns tournament and seedings
  const { tournament, seedings = [] } = data;
  return {
    tournament: {
      ...tournament,
      currentRoundMatches: tournament.matches?.filter((m: TournamentMatchWithRobots) => m.round === tournament.currentRound) || [],
      participantCount: tournament.totalParticipants,
      seedings,
    } as TournamentDetails,
    seedings,
  };
};

/**
 * Execute the current round of a tournament
 */
export const executeRound = async (
  tournamentId: number
): Promise<ExecuteRoundResponse> => {
  return api.post<ExecuteRoundResponse>(`/api/admin/tournaments/${tournamentId}/execute-round`, {});
};

/**
 * Get count of eligible robots for tournament
 */
export const getEligibleRobots = async (): Promise<EligibleRobotsResponse> => {
  return api.get<EligibleRobotsResponse>('/api/admin/tournaments/eligible-robots');
};
