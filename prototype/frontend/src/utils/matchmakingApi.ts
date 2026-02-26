import apiClient from './apiClient';

// Types
export interface ScheduledMatch {
  id: number | string; // Can be number for league or "tournament-X" string for tournaments or "tag-team-X" for tag teams
  matchType?: 'league' | 'tournament' | 'tag_team';
  tournamentId?: number;
  tournamentName?: string;
  tournamentRound?: number;
  currentRound?: number;
  maxRounds?: number;
  robot1Id?: number;
  robot2Id?: number;
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
  battleType?: string; // "league", "tournament", or "tag_team"
  leagueType?: string; // League at time of battle: "bronze", "silver", "gold", etc.
  tournamentId?: number | null;
  tournamentRound?: number | null;
  tournamentName?: string | null;
  tournamentMaxRounds?: number | null;
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
  };
}

export interface LeagueRobot {
  id: number;
  name: string;
  elo: number;
  leaguePoints: number;
  wins: number;
  draws: number;
  losses: number;
  totalBattles: number;
  currentHP: number;
  maxHP: number;
  fame: number;
  userId: number;
  user: {
    username: string;
    stableName: string | null;
  };
}

export interface LeagueInstance {
  leagueId: string;
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
  const response = await apiClient.get('/api/matches/upcoming');
  return response.data.matches || [];  // Extract matches array from response
};

export const getMatchHistory = async (
  page: number = 1,
  pageSize: number = 10,
  battleType?: 'overall' | 'league' | 'tournament' | 'tag_team'
): Promise<PaginatedResponse<BattleHistory>> => {
  const params: any = { page, perPage: pageSize };
  
  // Add battleType filter if not 'overall'
  if (battleType && battleType !== 'overall') {
    params.battleType = battleType;
  }
  
  console.log('[API] getMatchHistory params:', params);
  
  const response = await apiClient.get('/api/matches/history', {
    params,
  });
  return response.data;
};

export const getLeagueStandings = async (
  tier: string,
  page: number = 1,
  pageSize: number = 50,
  instance?: string
): Promise<PaginatedResponse<LeagueRobot>> => {
  const response = await apiClient.get(`/api/leagues/${tier}/standings`, {
    params: { page, pageSize, ...(instance && { instance }) },
  });
  return response.data;
};

export const getLeagueInstances = async (tier: string): Promise<LeagueInstance[]> => {
  const response = await apiClient.get(`/api/leagues/${tier}/instances`);
  return response.data;
};

export const getRobotMatches = async (
  robotId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<BattleHistory>> => {
  const response = await apiClient.get(`/api/robots/${robotId}/matches`, {
    params: { page, perPage: pageSize },
  });
  return response.data;
};

export const getRobotUpcomingMatches = async (robotId: number): Promise<ScheduledMatch[]> => {
  const response = await apiClient.get(`/api/robots/${robotId}/upcoming`);
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

export const getLeagueTierIcon = (tier: string): string => {
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

export const getBattleOutcome = (battle: BattleHistory, robotId: number): 'win' | 'loss' | 'draw' => {
  if (!battle.winnerId) return 'draw';
  
  // For tag team battles, winnerId is the team ID, not robot ID
  if (battle.battleType === 'tag_team' && battle.team1Id && battle.team2Id) {
    // Determine which team the robot belongs to
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;
    
    if (isTeam1Robot) {
      return battle.winnerId === battle.team1Id ? 'win' : 'loss';
    } else if (isTeam2Robot) {
      return battle.winnerId === battle.team2Id ? 'win' : 'loss';
    }
  }
  
  // For 1v1 battles, winnerId is the robot ID
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

export const getTournamentRoundName = (currentRound: number, maxRounds: number): string => {
  const roundsFromEnd = maxRounds - currentRound;
  
  if (roundsFromEnd === 0) return 'Finals';
  if (roundsFromEnd === 1) return 'Semi-finals';
  if (roundsFromEnd === 2) return 'Quarter-finals';
  
  return `Round ${currentRound}/${maxRounds}`;
};

/**
 * Get the reward amount for a specific robot in a battle.
 * Handles both 1v1 and tag team battle types.
 */
export const getBattleReward = (battle: BattleHistory, robotId: number): number => {
  // For tag team battles, determine reward based on team winner
  if (battle.battleType === 'tag_team' && battle.team1Id && battle.team2Id) {
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;
    
    if (isTeam1Robot) {
      return battle.winnerId === battle.team1Id ? battle.winnerReward : battle.loserReward;
    } else if (isTeam2Robot) {
      return battle.winnerId === battle.team2Id ? battle.winnerReward : battle.loserReward;
    }
  }
  
  // For 1v1 battles, winnerId is the robot ID
  return battle.winnerId === robotId ? battle.winnerReward : battle.loserReward;
};

// Battle Log Types
export interface BattleLogEvent {
  timestamp: number;
  type: string;
  message: string;
  [key: string]: any;
}

export interface BattleLogResponse {
  battleId: number;
  createdAt: string;
  battleType?: string;
  leagueType: string;
  duration: number;
  robot1: {
    id: number;
    name: string;
    owner: string;
    eloBefore: number;
    eloAfter: number;
    finalHP: number;
    damageDealt: number;
    reward?: number;
    prestige?: number;
    fame?: number;
    streamingRevenue?: number;
    streamingRevenueDetails?: {
      baseAmount: number;
      battleMultiplier: number;
      fameMultiplier: number;
      studioMultiplier: number;
      robotBattles: number;
      robotFame: number;
      studioLevel: number;
    } | null;
  };
  robot2: {
    id: number;
    name: string;
    owner: string;
    eloBefore: number;
    eloAfter: number;
    finalHP: number;
    damageDealt: number;
    reward?: number;
    prestige?: number;
    fame?: number;
    streamingRevenue?: number;
    streamingRevenueDetails?: {
      baseAmount: number;
      battleMultiplier: number;
      fameMultiplier: number;
      studioMultiplier: number;
      robotBattles: number;
      robotFame: number;
      studioLevel: number;
    } | null;
  };
  winner: 'robot1' | 'robot2' | null;
  battleLog: {
    events: BattleLogEvent[];
  };
  // Tag team specific fields
  tagTeam?: {
    team1: {
      activeRobot: {
        id: number;
        name: string;
        owner: string;
      } | null;
      reserveRobot: {
        id: number;
        name: string;
        owner: string;
      } | null;
      tagOutTime: number | null;
      stableName?: string | null;
      teamId?: number;
    };
    team2: {
      activeRobot: {
        id: number;
        name: string;
        owner: string;
      } | null;
      reserveRobot: {
        id: number;
        name: string;
        owner: string;
      } | null;
      tagOutTime: number | null;
      stableName?: string | null;
      teamId?: number;
    };
  };
  team1Summary?: {
    reward: number;
    prestige: number;
    totalDamage: number;
    totalFame: number;
    streamingRevenue?: number;
    streamingRevenueDetails?: {
      baseAmount: number;
      battleMultiplier: number;
      fameMultiplier: number;
      studioMultiplier: number;
      robotBattles: number;
      robotFame: number;
      studioLevel: number;
    } | null;
  };
  team2Summary?: {
    reward: number;
    prestige: number;
    totalDamage: number;
    totalFame: number;
    streamingRevenue?: number;
    streamingRevenueDetails?: {
      baseAmount: number;
      battleMultiplier: number;
      fameMultiplier: number;
      studioMultiplier: number;
      robotBattles: number;
      robotFame: number;
      studioLevel: number;
    } | null;
  };
}

export const getBattleLog = async (battleId: number): Promise<BattleLogResponse> => {
  const response = await apiClient.get(`/api/matches/battles/${battleId}/log`);
  return response.data;
};
