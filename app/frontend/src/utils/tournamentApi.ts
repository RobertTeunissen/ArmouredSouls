import { api } from './api';
import type { TournamentMatchWithRobots } from './bracketUtils';

// Types

export type ParticipantType = 'robot' | 'team_2v2' | 'team_3v3';

export interface SeedEntry {
  seed: number;
  robotId: number;
  robotName: string;
  elo: number;
  eliminated: boolean;
}

export interface ResolvedParticipant {
  id: number;
  displayName: string;
  leagueTier: string;
  elo: number;
  ownerId: number;
  ownerStableName?: string;
  members?: { robotId: number; robotName: string; elo: number }[];
}

export interface Tournament {
  id: number;
  name: string;
  tournamentType: string;
  participantType: ParticipantType;
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
    user?: { id: number; username: string; stableName: string | null };
  };
}

export interface TournamentDetails extends Tournament {
  matches: TournamentMatchWithRobots[];
  currentRoundMatches: TournamentMatchWithRobots[];
  participantCount: number;
  seedings: SeedEntry[];
  resolvedParticipants?: Record<number, ResolvedParticipant>;
}

// API Functions

/**
 * List all tournaments (public endpoint for all authenticated users)
 * Supports optional participantType filter.
 */
export const listTournaments = async (participantType?: ParticipantType): Promise<{ tournaments: Tournament[] }> => {
  const params = participantType ? `?participantType=${participantType}` : '';
  return api.get<{ tournaments: Tournament[] }>(`/api/tournaments${params}`);
};

/**
 * Get tournament details by ID (public endpoint for all authenticated users)
 */
export const getTournamentDetails = async (
  tournamentId: number
): Promise<{ tournament: TournamentDetails; seedings: SeedEntry[] }> => {
  const data = await api.get<{ tournament: Tournament & { matches?: TournamentMatchWithRobots[]; resolvedParticipants?: Record<number, ResolvedParticipant> }; seedings: SeedEntry[] }>(
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
      resolvedParticipants: tournament.resolvedParticipants,
    } as TournamentDetails,
    seedings,
  };
};
