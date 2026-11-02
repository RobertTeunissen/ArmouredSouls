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
