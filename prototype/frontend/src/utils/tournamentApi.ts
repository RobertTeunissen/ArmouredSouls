import apiClient from './apiClient';

// Types
export interface Tournament {
  id: number;
  name: string;
  type: string;
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
    currentHP: number;
    maxHP: number;
    user?: {
      id: number;
      username: string;
      stableName: string | null;
    };
  };
  robot2?: {
    id: number;
    name: string;
    elo: number;
    currentHP: number;
    maxHP: number;
    user?: {
      id: number;
      username: string;
      stableName: string | null;
    };
  };
}

export interface TournamentDetails extends Tournament {
  matches: TournamentMatch[];
  currentRoundMatches: TournamentMatch[];
  participantCount: number;
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
): Promise<{ tournament: TournamentDetails }> => {
  const response = await apiClient.get(`/api/tournaments/${tournamentId}`);
  
  // Backend returns tournament directly
  const { tournament } = response.data;
  return {
    tournament: {
      ...tournament,
      currentRoundMatches: tournament.matches?.filter((m: TournamentMatch) => m.round === tournament.currentRound) || [],
    }
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
