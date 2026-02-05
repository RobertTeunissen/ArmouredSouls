import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

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
export const createTournament = async (token: string): Promise<CreateTournamentResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/admin/tournaments/create`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

/**
 * List all tournaments
 */
export const listTournaments = async (token: string): Promise<{ tournaments: Tournament[] }> => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/tournaments`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

/**
 * Get tournament details by ID
 */
export const getTournamentDetails = async (
  token: string,
  tournamentId: number
): Promise<{ tournament: TournamentDetails }> => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/tournaments/${tournamentId}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  // Backend returns tournament and currentRoundMatches separately
  // Merge them for easier frontend consumption
  const { tournament, currentRoundMatches } = response.data;
  return {
    tournament: {
      ...tournament,
      currentRoundMatches: currentRoundMatches || [],
    }
  };
};

/**
 * Execute the current round of a tournament
 */
export const executeRound = async (
  token: string,
  tournamentId: number
): Promise<ExecuteRoundResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/admin/tournaments/${tournamentId}/execute-round`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

/**
 * Get count of eligible robots for tournament
 */
export const getEligibleRobots = async (token: string): Promise<EligibleRobotsResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/admin/tournaments/eligible-robots`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};
