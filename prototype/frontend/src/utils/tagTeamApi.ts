import apiClient from './apiClient';

// Types
export interface TagTeamRobot {
  id: number;
  name: string;
  elo: number;
  currentHP: number;
  maxHP: number;
  currentShield?: number;
  maxShield?: number;
  yieldThreshold: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainWeapon?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offhandWeapon?: any;
}

export interface ReadinessStatus {
  isReady: boolean;
  activeRobotReady: boolean;
  reserveRobotReady: boolean;
  activeRobotIssues: string[];
  reserveRobotIssues: string[];
}

export interface TagTeam {
  id: number;
  stableId: number;
  activeRobotId: number;
  reserveRobotId: number;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
  tagTeamLeaguePoints: number;
  cyclesInTagTeamLeague: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: string;
  updatedAt: string;
  activeRobot: TagTeamRobot;
  reserveRobot: TagTeamRobot;
  readiness?: ReadinessStatus;
  combinedELO?: number;
  stable?: {
    stableName: string | null;
  };
}

export interface TagTeamStanding {
  rank: number;
  teamId: number;
  stableId: number;
  tagTeamLeagueId: string;
  tagTeamLeaguePoints: number;
  combinedELO: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  stableName: string | null;
  activeRobot: {
    id: number;
    name: string;
    elo: number;
  };
  reserveRobot: {
    id: number;
    name: string;
    elo: number;
  };
}

export interface PaginatedStandings {
  standings: TagTeamStanding[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  tier: string;
}

// API Functions
export const getMyTagTeams = async (): Promise<TagTeam[]> => {
  const response = await apiClient.get('/api/tag-teams');
  return response.data.teams || [];
};

export const getTagTeamById = async (teamId: number): Promise<TagTeam> => {
  const response = await apiClient.get(`/api/tag-teams/${teamId}`);
  return response.data.team;
};

export const createTagTeam = async (activeRobotId: number, reserveRobotId: number): Promise<TagTeam> => {
  const response = await apiClient.post('/api/tag-teams', { activeRobotId, reserveRobotId });
  return response.data.team;
};

export const disbandTagTeam = async (teamId: number): Promise<void> => {
  await apiClient.delete(`/api/tag-teams/${teamId}`);
};

export const getTagTeamStandings = async (
  tier: string,
  page: number = 1,
  perPage: number = 50
): Promise<PaginatedStandings> => {
  const response = await apiClient.get(`/api/tag-teams/leagues/${tier}/standings`, {
    params: { page, perPage },
  });
  return response.data;
};

// Helper Functions
export const getTagTeamLeagueTierName = (tier: string): string => {
  const tierNames: { [key: string]: string } = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
    champion: 'Champion'
  };
  return tierNames[tier] || tier;
};

export const getTagTeamLeagueTierColor = (tier: string): string => {
  const colors: { [key: string]: string } = {
    bronze: 'text-orange-600',
    silver: 'text-gray-400',
    gold: 'text-yellow-500',
    platinum: 'text-cyan-400',
    diamond: 'text-blue-400',
    champion: 'text-purple-500'
  };
  return colors[tier] || 'text-gray-400';
};

export const getTagTeamLeagueTierIcon = (tier: string): string => {
  const icons: { [key: string]: string } = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '💎',
    diamond: '💠',
    champion: '👑',
  };
  return icons[tier.toLowerCase()] || '⚔️';
};

export const TAG_TEAM_LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type TagTeamLeagueTier = typeof TAG_TEAM_LEAGUE_TIERS[number];

/**
 * Generate a team name based on stable name and team ID
 * If stable has a name, use "StableName 1", "StableName 2", etc.
 * Otherwise, use "Team {teamId}"
 */
export const getTeamName = (team: TagTeam | TagTeamStanding, allTeamsFromStable?: (TagTeam | TagTeamStanding)[]): string => {
  // Get stable name - check both possible locations
  let stableName: string | null = null;
  
  // TagTeamStanding has stableName directly
  if ('stableName' in team && team.stableName) {
    stableName = team.stableName;
  }
  // TagTeam has it nested in stable object
  else if ('stable' in team && team.stable?.stableName) {
    stableName = team.stable.stableName;
  }
  
  if (!stableName) {
    return `Team ${('teamId' in team ? team.teamId : team.id)}`;
  }
  
  // If we have all teams from the stable, calculate the team number
  if (allTeamsFromStable && allTeamsFromStable.length > 1) {
    // Sort teams by ID to get consistent numbering
    const sortedTeams = [...allTeamsFromStable].sort((a, b) => {
      const aId = 'teamId' in a ? a.teamId : a.id;
      const bId = 'teamId' in b ? b.teamId : b.id;
      return aId - bId;
    });
    
    const teamId = 'teamId' in team ? team.teamId : team.id;
    const teamIndex = sortedTeams.findIndex(t => {
      const tId = 'teamId' in t ? t.teamId : t.id;
      return tId === teamId;
    });
    
    if (teamIndex >= 0) {
      return `${stableName} ${teamIndex + 1}`;
    }
  }
  
  // Default to just the stable name if we can't determine the number
  return stableName;
};

/**
 * Generate a team name from match team data
 * Used for upcoming/recent matches where we have team info but not full TagTeam object
 */
export const getTeamNameFromMatch = (teamId: number, stableName: string | null): string => {
  if (stableName) {
    return stableName;
  }
  return `Team ${teamId}`;
};
