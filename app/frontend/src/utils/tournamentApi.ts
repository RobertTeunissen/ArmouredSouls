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

export interface TournamentDetails extends Tournament {
  matches: TournamentMatchWithRobots[];
  currentRoundMatches: TournamentMatchWithRobots[];
  participantCount: number;
  seedings: SeedEntry[];
}

// API Functions

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
