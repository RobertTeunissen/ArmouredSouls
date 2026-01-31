import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Types
export interface ScheduledMatch {
  id: number;
  robot1Id: number;
  robot2Id: number;
  leagueType: string;
  scheduledFor: string;
  status: string;
  robot1: {
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
  robot2: {
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
}

export interface BattleHistory {
  id: number;
  robot1Id: number;
  robot2Id: number;
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
  robot1: {
    id: number;
    name: string;
    userId: number;
    user: {
      username: string;
    };
  };
  robot2: {
    id: number;
    name: string;
    userId: number;
    user: {
      username: string;
    };
  };
}

export interface LeagueRobot {
  id: number;
  name: string;
  elo: number;
  leaguePoints: number;
  wins: number;
  losses: number;
  totalBattles: number;
  currentHP: number;
  maxHP: number;
  userId: number;
  user: {
    username: string;
  };
}

export interface LeagueInstance {
  leagueId: number;
  leagueTier: string;
  currentRobots: number;
  maxRobots: number;
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
export const getUpcomingMatches = async (): Promise<ScheduledMatch[]> => {
  const response = await axios.get(`${API_BASE_URL}/matches/upcoming`);
  return response.data;
};

export const getMatchHistory = async (
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<BattleHistory>> => {
  const response = await axios.get(`${API_BASE_URL}/matches/history`, {
    params: { page, pageSize }
  });
  return response.data;
};

export const getLeagueStandings = async (
  tier: string,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResponse<LeagueRobot>> => {
  const response = await axios.get(`${API_BASE_URL}/leagues/${tier}/standings`, {
    params: { page, pageSize }
  });
  return response.data;
};

export const getLeagueInstances = async (tier: string): Promise<LeagueInstance[]> => {
  const response = await axios.get(`${API_BASE_URL}/leagues/${tier}/instances`);
  return response.data;
};

export const getRobotMatches = async (
  robotId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<BattleHistory>> => {
  const response = await axios.get(`${API_BASE_URL}/robots/${robotId}/matches`, {
    params: { page, pageSize }
  });
  return response.data;
};

export const getRobotUpcomingMatches = async (robotId: number): Promise<ScheduledMatch[]> => {
  const response = await axios.get(`${API_BASE_URL}/robots/${robotId}/upcoming`);
  return response.data;
};

// Helper Functions
export const getLeagueTierName = (tier: string): string => {
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

export const getLeagueTierColor = (tier: string): string => {
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

export const getBattleOutcome = (battle: BattleHistory, robotId: number): 'win' | 'loss' | 'draw' => {
  if (!battle.winnerId) return 'draw';
  return battle.winnerId === robotId ? 'win' : 'loss';
};

export const getELOChange = (battle: BattleHistory, robotId: number): number => {
  if (battle.robot1Id === robotId) {
    return battle.robot1ELOAfter - battle.robot1ELOBefore;
  } else {
    return battle.robot2ELOAfter - battle.robot2ELOBefore;
  }
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};
