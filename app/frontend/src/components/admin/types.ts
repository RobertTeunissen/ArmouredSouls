/**
 * Shared type definitions for Admin Page tab components.
 * Extracted from AdminPage.tsx for use across decomposed tab components.
 */

export interface SystemStats {
  robots: {
    total: number;
    /** League 1v1 tiers from `standings`, restricted to the filter. */
    byTier: Array<{ league: string; count: number; averageElo?: number }>;
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
    byType?: {
      league: { total: number; draws: number; drawPercentage: number; kills: number; killPercentage: number; avgDuration: number };
      tournament: { total: number; draws: number; drawPercentage: number; kills: number; killPercentage: number; avgDuration: number };
      tagTeam: { total: number; draws: number; drawPercentage: number; kills: number; killPercentage: number; avgDuration: number };
      koth: { total: number; draws: number; drawPercentage: number; kills: number; killPercentage: number; avgDuration: number };
    };
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
      /** Stables owning the facility at level 1 or higher. */
      purchaseCount: number;
      avgLevel: number;
    }>;
    totalPurchases: number;
    mostPopular: string;
  };
  weapons: {
    totalBought: number;
    /** Robots with a main weapon (ignores offhands). */
    equipped: number;
    /** Owned weapons sitting in any robot's main or offhand slot. */
    equippedInventoryItems?: number;
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
  lastLoginAt: string | null;
  churnRisk: 'low' | 'medium' | 'high';
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
  /** Every user in range; `users` lists at most the 500 newest of them. */
  totalUsers: number;
  /** Listed users with at least one issue. */
  usersWithIssues: number;
  users: RecentUser[];
  timestamp: string;
}

/** Repair log event from the admin audit-log repairs endpoint */
export interface RepairLogEvent {
  userId: number;
  stableName: string;
  robotId: number;
  robotName: string;
  repairType: 'manual' | 'automatic';
  /** Credits actually deducted. Renamed from `cost` by Spec #48 Requirement 17. */
  creditsCharged: number;
  /**
   * The same repair priced before the manual discount and after the Repair Bay
   * discount. Null on an automatic repair, which applies no manual discount.
   * Renamed from `preDiscountCost`.
   */
  creditsBeforeManualDiscount: number | null;
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
