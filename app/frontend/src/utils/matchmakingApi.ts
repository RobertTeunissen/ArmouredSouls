import { api } from './api';

// Re-export formatters from their new home for backwards compatibility.
// New code should import directly from './battleFormatters'.
export {
  getBattleOutcome,
  getELOChange,
  formatDateTime,
  formatDuration,
  getTournamentRoundName,
  getBattleReward,
  isTeamBattleType,
} from './battleFormatters';

// Types
export interface ScheduledMatch {
  id: number | string; // Can be number for league or "tournament-X" string for tournaments or "tag-team-X" for tag teams
  matchType?: 'league_1v1' | 'tournament_1v1' | 'tag_team' | 'koth' | 'grand_melee' | 'league_2v2' | 'league_3v3' | 'tournament_2v2' | 'tournament_3v3';
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
  kothParticipants?: Array<{ id: number; name: string; elo: number; userId?: number; user?: { username: string } }>;
  // Team Battle specific fields
  teamSize?: number;
  teamBattleLeague?: string;
  teamBattleTeam1?: {
    id: number;
    teamName: string;
    teamSize: number;
    teamLp: number;
    teamLeague: string;
    members: Array<{ robotId: number; robotName: string; robotElo: number; userId: number; user: { username: string } }>;
    combinedELO: number;
  };
  teamBattleTeam2?: {
    id: number;
    teamName: string;
    teamSize: number;
    teamLp: number;
    teamLeague: string;
    members: Array<{ robotId: number; robotName: string; robotElo: number; userId: number; user: { username: string } }>;
    combinedELO: number;
  } | null;
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
  battleType?: string; // "league_1v1", "tournament_1v1", "tag_team", "koth", or "grand_melee"
  leagueType?: string; // League at time of battle: "bronze", "silver", "gold", etc.
  tournamentId?: number | null;
  tournamentRound?: number | null;
  tournamentName?: string | null;
  tournamentMaxRounds?: number | null;
  // KotH specific fields
  kothPlacement?: number;
  kothParticipantCount?: number;
  kothZoneScore?: number;
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
  // Bye match indicator
  isByeMatch?: boolean;
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
  cyclesInCurrentLeague: number;
  eligible: boolean;
  isSubscribed?: boolean;
  user: {
    username: string;
    stableName: string | null;
  };
  zone: 'promotion' | 'demotion' | null;
}

export interface ZoneMeta {
  tier: string;
  minLP: number;
  minCycles: number;
  minRobotsRequired: number;
  eligibleCount: number;
  hasEnoughRobots: boolean;
  promotionSlots: number;
  demotionSlots: number;
  isChampion: boolean;
  isBronze: boolean;
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

export interface LeagueStandingsResponse extends PaginatedResponse<LeagueRobot> {
  zoneMeta: ZoneMeta;
}

// API Functions
export const getUpcomingMatches = async (robotId?: number): Promise<ScheduledMatch[]> => {
  const params = robotId ? { robotId } : undefined;
  const response = await api.get<{ matches: ScheduledMatch[] }>(
    '/api/matches/upcoming',
    params ? { params } : undefined,
  );
  return response.matches || [];  // Extract matches array from response
};

export const getMatchHistory = async (
  page: number = 1,
  pageSize: number = 10,
  battleType?: 'overall' | 'league' | 'tournament' | 'tag_team' | 'koth' | 'grand_melee' | 'league_2v2' | 'league_3v3' | 'tournament_2v2' | 'tournament_3v3',
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
  
  return api.get<PaginatedResponse<BattleHistory>>('/api/matches/history', { params });
};

export const getLeagueStandings = async (
  tier: string,
  page: number = 1,
  pageSize: number = 50,
  instance?: string,
  mode?: string
): Promise<LeagueStandingsResponse> => {
  return api.get<LeagueStandingsResponse>(`/api/leagues/${tier}/standings`, {
    params: {
      page,
      perPage: pageSize,
      ...(instance && { instance }),
      ...(mode && { mode }),
    },
  });
};

export const getLeagueInstances = async (tier: string, mode?: string): Promise<LeagueInstance[]> => {
  return api.get<LeagueInstance[]>(`/api/leagues/${tier}/instances`, {
    params: { ...(mode && { mode }) },
  });
};

// Re-export tier helpers from single source of truth
export { getTierName as getLeagueTierName, getTierColor as getLeagueTierColor, getTierIcon as getLeagueTierIcon } from './tierHelpers';

// Battle Log Types
export interface BattleLogEvent {
  timestamp: number;
  type: string;
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ── Team Battle Log Types ─────────────────────────────────────────────

/** Per-team aggregated metric (team1 vs team2). */
export interface TeamMetricPair {
  team1: number;
  team2: number;
}

/** Individual robot performance within a Team Battle. */
export interface TeamBattleParticipantResult {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  damageTaken: number;
  finalHP: number;
  survivalSeconds: number;
}

/** Focus fire event aggregated for metrics. */
export interface TeamBattleFocusFireEvent {
  tick: number;
  targetRobotId: number;
  contributorRobotIds: number[];
  contributorCount: number;
  bonusApplied: number;
}

/**
 * Team Battle log structure stored in `battleLog` field when
 * `battleType === 'league_2v2'` or `battleType === 'league_3v3'`.
 */
export interface TeamBattleLog {
  teamBattle: true;
  teamSize: 2 | 3;
  winningSide: 1 | 2 | null;
  isDraw: boolean;
  isByeMatch: boolean;
  durationSeconds: number;
  participants: TeamBattleParticipantResult[];
  events: BattleLogEvent[];
  detailedCombatEvents?: BattleLogEvent[];
  focusFireEvents: TeamBattleFocusFireEvent[];
  focusFireMetrics: TeamMetricPair;
  allySupportMetrics: TeamMetricPair;
  formationDefenceMetrics: TeamMetricPair;
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
}

/** Type guard to check if a battle log is a team battle log. */
export function isTeamBattleLog(log: BattleLogResponse['battleLog']): log is TeamBattleLog {
  return (log as TeamBattleLog)?.teamBattle === true;
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
  leagueInstanceId?: string | null;
  tournamentId?: number | null;
  duration: number;
  /** Whether the full battle_log (playback events) is still available (pruned after 7 days) */
  playbackAvailable?: boolean;
  /** Pre-computed battle statistics from battle_summaries table (Spec #39) */
  summary?: {
    perRobot: import('../../../shared/utils/battleStatistics').RobotCombatStats[];
    perTeam: { teamName: string; robots: string[]; totalDamageDealt: number; totalDamageReceived: number; totalHits: number; totalMisses: number; totalCriticals: number }[] | null;
    damageFlows: import('../../../shared/utils/battleStatistics').DamageFlow[];
    participants: { robotId: number; team: number; survivalSeconds: number }[];
    kothPlacements?: unknown[];
    kothData?: { participantCount: number; scoreThreshold: number };
    startingPositions?: Record<string, { x: number; y: number }>;
    endingPositions?: Record<string, { x: number; y: number }>;
    arenaRadius?: number;
    battleDuration: number;
    totalEvents: number;
    hasData: boolean;
  };
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
