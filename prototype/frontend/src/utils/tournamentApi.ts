import apiClient from './apiClient';
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
export const createTournament = async (_token: string): Promise<CreateTournamentResponse> => {
  const response = await apiClient.post('/api/admin/tournaments/create', {});
  return response.data;
};

/**
 * List all tournaments (public endpoint for all authenticated users)
 */
export const listTournaments = async (_token: string): Promise<{ tournaments: Tournament[] }> => {
  const response = await apiClient.get('/api/tournaments');
  return response.data;
};

/**
 * Get tournament details by ID (public endpoint for all authenticated users)
 */
export const getTournamentDetails = async (
  _token: string,
  tournamentId: number
): Promise<{ tournament: TournamentDetails; seedings: SeedEntry[] }> => {
  const response = await apiClient.get(`/api/tournaments/${tournamentId}`);
  
  // Backend returns tournament and seedings
  const { tournament, seedings = [] } = response.data;
  return {
    tournament: {
      ...tournament,
      currentRoundMatches: tournament.matches?.filter((m: TournamentMatchWithRobots) => m.round === tournament.currentRound) || [],
      seedings,
    },
    seedings,
  };
};

/**
 * Execute the current round of a tournament
 */
export const executeRound = async (
  _token: string,
  tournamentId: number
): Promise<ExecuteRoundResponse> => {
  const response = await apiClient.post(`/api/admin/tournaments/${tournamentId}/execute-round`, {});
  return response.data;
};

/**
 * Get count of eligible robots for tournament
 */
export const getEligibleRobots = async (_token: string): Promise<EligibleRobotsResponse> => {
  const response = await apiClient.get('/api/admin/tournaments/eligible-robots');
  return response.data;
};
