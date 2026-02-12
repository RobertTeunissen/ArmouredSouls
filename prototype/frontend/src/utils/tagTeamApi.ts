import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

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
  mainWeapon?: any;
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
  const response = await axios.get(`${API_BASE_URL}/tag-teams`, {
    headers: getAuthHeaders()
  });
  return response.data.teams || [];
};

export const getTagTeamById = async (teamId: number): Promise<TagTeam> => {
  const response = await axios.get(`${API_BASE_URL}/tag-teams/${teamId}`, {
    headers: getAuthHeaders()
  });
  return response.data.team;
};

export const createTagTeam = async (activeRobotId: number, reserveRobotId: number): Promise<TagTeam> => {
  const response = await axios.post(
    `${API_BASE_URL}/tag-teams`,
    { activeRobotId, reserveRobotId },
    { headers: getAuthHeaders() }
  );
  return response.data.team;
};

export const disbandTagTeam = async (teamId: number): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/tag-teams/${teamId}`, {
    headers: getAuthHeaders()
  });
};

export const getTagTeamStandings = async (
  tier: string,
  page: number = 1,
  perPage: number = 50
): Promise<PaginatedStandings> => {
  const response = await axios.get(`${API_BASE_URL}/tag-teams/leagues/${tier}/standings`, {
    params: { page, perPage },
    headers: getAuthHeaders()
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
