import { api } from './api';

// Types
export interface ScheduledMatch {
  id: number | string; // Can be number for league or "tournament-X" string for tournaments or "tag-team-X" for tag teams
  matchType?: 'league' | 'tournament' | 'tag_team' | 'koth';
  tournamentId?: number;
  tournamentName?: string;
  tournamentRound?: number;
  currentRound?: number;
  maxRounds?: number;
  robot1Id?: number;
  robot2Id?: number;
  isByeMatch?: boolean;
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
  // KotH specific fields
  kothParticipantCount?: number;
  kothRotatingZone?: boolean;
  kothParticipants?: Array<{ id: number; name: string; elo: number; userId?: number; user?: { username: string } }>;
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
  // KotH specific fields
  kothPlacement?: number;
  kothParticipantCount?: number;
  kothZoneScore?: number;
  kothRotatingZone?: boolean;
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
  // Economic fields (from BattleParticipant for the requesting user's robot)
  prestigeAwarded?: number;
  fameAwarded?: number;
  streamingRevenue?: number;
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
export const getUpcomingMatches = async (robotId?: number): Promise<ScheduledMatch[]> => {
  const params = robotId ? { robotId } : undefined;
  const response = await api.get<{ matches: ScheduledMatch[] }>('/api/matches/upcoming', params);
  return response.matches || [];  // Extract matches array from response
};

export const getMatchHistory = async (
  page: number = 1,
  pageSize: number = 10,
  battleType?: 'overall' | 'league' | 'tournament' | 'tag_team' | 'koth',
  robotId?: number
): Promise<PaginatedResponse<BattleHistory>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = { page, perPage: pageSize };
  
  // Add battleType filter if not 'overall'
  if (battleType && battleType !== 'overall') {
    params.battleType = battleType;
  }

  // Add robotId filter to fetch battles for a specific robot
  if (robotId) {
    params.robotId = robotId;
  }
  
  console.log('[API] getMatchHistory params:', params);
  
  return api.get<PaginatedResponse<BattleHistory>>('/api/matches/history', params);
};

export const getLeagueStandings = async (
  tier: string,
  page: number = 1,
  pageSize: number = 50,
  instance?: string
): Promise<PaginatedResponse<LeagueRobot>> => {
  return api.get<PaginatedResponse<LeagueRobot>>(`/api/leagues/${tier}/standings`, {
    page,
    pageSize,
    ...(instance && { instance }),
  });
};

export const getLeagueInstances = async (tier: string): Promise<LeagueInstance[]> => {
  return api.get<LeagueInstance[]>(`/api/leagues/${tier}/instances`);
};

export const getRobotMatches = async (
  robotId: number,
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedResponse<BattleHistory>> => {
  return api.get<PaginatedResponse<BattleHistory>>(`/api/robots/${robotId}/matches`, {
    page,
    perPage: pageSize,
  });
};

export const getRobotUpcomingMatches = async (robotId: number): Promise<ScheduledMatch[]> => {
  return api.get<ScheduledMatch[]>(`/api/robots/${robotId}/upcoming`);
};

// Re-export tier helpers from single source of truth
export { getTierName as getLeagueTierName, getTierColor as getLeagueTierColor, getTierIcon as getLeagueTierIcon } from './tierHelpers';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Unified participant record — same shape for all battle types (1v1, tag team, KotH) */
export interface BattleLogParticipant {
  robotId: number;
  robotName: string;
  owner: string;
  ownerId: number;
  imageUrl: string | null;
  teamIndex: number;
  team: number;
  role: string | null;
  placement: number | null;
  // Combat outcome
  finalHP: number;
  maxHP: number;
  maxShield: number;
  destroyed: boolean;
  yielded: boolean;
  damageDealt: number;
  // Economy
  eloBefore: number;
  eloAfter: number;
  credits: number;
  streamingRevenue: number;
  prestigeAwarded: number;
  fameAwarded: number;
  // Loadout
  stance: string;
  loadoutType: string;
  mainWeaponName: string | null;
  mainWeaponRangeBand: string | null;
  offhandWeaponName: string | null;
  offhandWeaponRangeBand: string | null;
}

export interface BattleLogResponse {
  battleId: number;
  createdAt: string;
  battleType?: string;
  leagueType: string;
  tournamentId?: number | null;
  duration: number;
  /** Unified participants array — single source of truth for all battle types */
  participants?: BattleLogParticipant[];
  robot1?: {
    id: number;
    name: string;
    owner: string;
    ownerId?: number;
    maxHP?: number;
    maxShield?: number;
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
    yielded?: boolean;
    destroyed?: boolean;
    imageUrl?: string | null;
    loadoutType?: string;
    rangeBand?: string | null;
    stance?: string;
    mainWeaponName?: string | null;
    offhandWeaponName?: string | null;
    offhandRangeBand?: string | null;
  };
  robot2?: {
    id: number;
    name: string;
    owner: string;
    ownerId?: number;
    maxHP?: number;
    maxShield?: number;
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
    yielded?: boolean;
    destroyed?: boolean;
    imageUrl?: string | null;
    loadoutType?: string;
    rangeBand?: string | null;
    stance?: string;
    mainWeaponName?: string | null;
    offhandWeaponName?: string | null;
    offhandRangeBand?: string | null;
  };
  winner: 'robot1' | 'robot2' | null;
  battleLog: {
    events: BattleLogEvent[];
    // Raw simulator events with full spatial data (positions, HP, shields)
    detailedCombatEvents?: BattleLogEvent[];
    // Tournament metadata
    isTournament?: boolean;
    round?: number;
    maxRounds?: number;
    isFinals?: boolean;
    // KotH metadata
    isKothMatch?: boolean;
    participantCount?: number;
    // 2D arena spatial metadata
    arenaRadius?: number;
    startingPositions?: Record<string, { x: number; y: number }>;
    endingPositions?: Record<string, { x: number; y: number }>;
    placements?: Array<{ robotId: number; robotName: string; zoneScore: number; zoneTime: number; kills: number; destroyed: boolean }>;
  };
  // Tag team specific fields
  tagTeam?: {
    team1: {
      activeRobot: {
        id: number;
        name: string;
        owner: string;
        maxHP?: number;
        maxShield?: number;
        imageUrl?: string | null;
      } | null;
      reserveRobot: {
        id: number;
        name: string;
        owner: string;
        maxHP?: number;
        maxShield?: number;
        imageUrl?: string | null;
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
        maxHP?: number;
        maxShield?: number;
        imageUrl?: string | null;
      } | null;
      reserveRobot: {
        id: number;
        name: string;
        owner: string;
        maxHP?: number;
        maxShield?: number;
        imageUrl?: string | null;
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
  // KotH specific fields
  kothParticipants?: Array<{
    robotId: number;
    robotName: string;
    owner: string;
    ownerId?: number;
    placement: number;
    zoneScore: number;
    zoneTime: number;
    kills: number;
    damageDealt: number;
    finalHP: number;
    destroyed: boolean;
    credits: number;
    fame: number;
    prestige: number;
    streamingRevenue: number;
    imageUrl?: string | null;
  }>;
  // KotH playback data
  kothData?: {
    isKoth: boolean;
    participantCount: number;
    scoreThreshold: number;
    zoneRadius: number;
    colorPalette: string[];
  };
  /** Achievement unlocks triggered by this battle (empty array if none) */
  achievementUnlocks?: Array<{
    id: string;
    name: string;
    description: string;
    tier: string;
    rewardCredits: number;
    rewardPrestige: number;
    badgeIconFile: string;
  }>;
}

export const getBattleLog = async (battleId: number): Promise<BattleLogResponse> => {
  return api.get<BattleLogResponse>(`/api/matches/battles/${battleId}/log`);
};
