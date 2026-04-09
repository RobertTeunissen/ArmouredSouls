/**
 * Shared type definitions for Admin Page tab components.
 * Extracted from AdminPage.tsx for use across decomposed tab components.
 */

export interface SessionLogEntry {
  timestamp: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  details?: unknown;
}

export interface SystemStats {
  robots: {
    total: number;
    byTier: Array<{ league: string; count: number }>;
    battleReady: number;
    battleReadyPercentage: number;
  };
  matches: {
    scheduled: number;
    completed: number;
    byType?: {
      league: { scheduled: number; completed: number };
      tournament: { scheduled: number; completed: number };
      tagTeam: { scheduled: number; completed: number };
      koth: { scheduled: number; completed: number };
    };
  };
  battles: {
    last24Hours: number;
    total: number;
    draws: number;
    drawPercentage: number;
    avgDuration: number;
    kills: number;
    killPercentage: number;
  };
  finances: {
    totalCredits: number;
    avgBalance: number;
    usersAtRisk: number;
    totalUsers: number;
  };
  facilities: {
    summary: Array<{
      type: string;
      purchaseCount: number;
      avgLevel: number;
    }>;
    totalPurchases: number;
    mostPopular: string;
  };
  weapons: {
    totalBought: number;
    equipped: number;
  };
  stances: Array<{
    stance: string;
    count: number;
  }>;
  loadouts: Array<{
    type: string;
    count: number;
  }>;
  yieldThresholds: {
    distribution: Array<{
      threshold: number;
      count: number;
    }>;
    mostCommon: number;
    mostCommonCount: number;
  };
}

export interface Battle {
  id: number;
  robot1: { id: number; name: string };
  robot2: { id: number; name: string };
  winnerId: number | null;
  winnerName: string;
  leagueType: string;
  durationSeconds: number;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1ELOBefore: number;
  robot2ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOAfter: number;
  createdAt: string;
  /** Distinguishes 1v1 from 2v2 battles when returned by the admin battles endpoint */
  battleFormat?: '1v1' | '2v2';
  /** Battle type: league, tournament, tagteam, or koth */
  battleType?: 'league' | 'tournament' | 'tagteam' | 'koth';
  /** Team 1 active robot name (for 2v2 tag team battles) */
  team1ActiveName?: string;
  /** Team 1 reserve robot name (for 2v2 tag team battles) */
  team1ReserveName?: string;
  /** Team 2 active robot name (for 2v2 tag team battles) */
  team2ActiveName?: string;
  /** Team 2 reserve robot name (for 2v2 tag team battles) */
  team2ReserveName?: string;
  /** Team 1 ID (for 2v2 tag team battles) */
  team1Id?: number;
  /** Team 2 ID (for 2v2 tag team battles) */
  team2Id?: number;
}

export interface BattleListResponse {
  battles: Battle[];
  pagination: {
    page: number;
    limit: number;
    totalBattles: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface RobotStats {
  summary: {
    totalRobots: number;
    robotsWithBattles: number;
    totalBattles: number;
    overallWinRate: number;
    averageElo: number;
  };
  attributeStats: Record<string, {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    lowerBound: number;
    upperBound: number;
  }>;
  outliers: Record<string, Array<{
    id: number;
    name: string;
    value: number;
    league: string;
    elo: number;
    winRate: number;
  }>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statsByLeague: Record<string, any>;
  winRateAnalysis: Record<string, Array<{
    quintile: number;
    avgValue: number;
    avgWinRate: number;
    sampleSize: number;
  }>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topPerformers: Record<string, any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bottomPerformers: Record<string, any[]>;
}

export interface AtRiskUser {
  userId: number;
  username: string;
  stableName: string;
  currentBalance: number;
  totalRepairCost: number;
  netBalance: number;
  cyclesAtRisk: number;
  firstAtRiskCycle: number | null;
  daysOfRunway: number;
  robotCount: number;
  damagedRobots: number;
  balanceHistory: Array<{
    cycle: number;
    timestamp: string;
    balance: number;
    dailyCost: number;
    dailyIncome: number;
  }>;
  createdAt: string;
}

export interface AtRiskUsersResponse {
  threshold: number;
  currentCycle: number;
  totalAtRisk: number;
  users: AtRiskUser[];
  timestamp: string;
}

export interface RecentUserRobot {
  id: number;
  name: string;
  currentHP: number;
  maxHP: number;
  hpPercent: number;
  elo: number;
  league: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  battleReady: boolean;
  hasWeapon: boolean;
  loadout: string;
  stance: string;
  createdAt: string;
}

export interface RecentUser {
  userId: number;
  username: string;
  stableName: string | null;
  currency: number;
  role: string;
  createdAt: string;
  onboarding: {
    completed: boolean;
    skipped: boolean;
    currentStep: number;
    strategy: string | null;
  };
  robots: RecentUserRobot[];
  summary: {
    totalRobots: number;
    battleReadyRobots: number;
    robotsWithBattles: number;
    totalBattles: number;
    totalWins: number;
    winRate: number;
    facilitiesPurchased: number;
  };
  issues: string[];
}

export interface RecentUsersResponse {
  currentCycle: number;
  cyclesBack: number;
  cutoffDate: string | null;
  totalUsers: number;
  usersWithIssues: number;
  users: RecentUser[];
  timestamp: string;
}

/** Tag team battle data shape for 2v2 battles displayed in admin Battle Logs */
export interface TagTeamBattle extends Battle {
  battleFormat: '1v1' | '2v2';
  teams?: {
    team1: {
      id: number;
      activeRobot: { id: number; name: string };
      reserveRobot: { id: number; name: string };
      stableId: number;
      league: string;
    };
    team2: {
      id: number;
      activeRobot: { id: number; name: string };
      reserveRobot: { id: number; name: string };
      stableId: number;
      league: string;
    };
  };
}

/** Repair log event from the admin audit-log repairs endpoint */
export interface RepairLogEvent {
  userId: number;
  stableName: string;
  robotId: number;
  robotName: string;
  repairType: 'manual' | 'automatic';
  cost: number;
  preDiscountCost: number | null;
  manualRepairDiscount: number | null;
  eventTimestamp: string;
}

/** Response shape for GET /api/admin/audit-log/repairs */
export interface RepairLogResponse {
  events: RepairLogEvent[];
  summary: {
    totalManualRepairs: number;
    totalAutomaticRepairs: number;
    totalSavings: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalEvents: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/** Security event from the admin security monitoring API */
export interface SecurityEvent {
  severity: 'info' | 'warning' | 'critical';
  eventType: string;
  userId?: number;
  stableName?: string;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/** Response shape for GET /api/admin/security/summary */
export interface SecuritySummary {
  totalEvents: number;
  bySeverity: Record<'info' | 'warning' | 'critical', number>;
  activeAlerts: number;
  flaggedUserIds: number[];
}

/** Response shape for GET /api/admin/security/events */
export interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
}
