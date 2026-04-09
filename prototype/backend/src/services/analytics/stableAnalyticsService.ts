/**
 * Stable Analytics Service
 *
 * Handles stable (user) financial summary analytics — income, expenses,
 * purchases, and net profit over cycle ranges.
 *
 * Requirements: 12.1
 */

import prisma from '../../lib/prisma';
import { cycleSnapshotService } from '../cycle/cycleSnapshotService';

interface CycleBreakdown {
  battleCredits: number;
  merchandising: number;
  streaming: number;
  repairCosts: number;
  operatingCosts: number;
  weaponPurchases: number;
  facilityPurchases: number;
  robotPurchases: number;
  attributeUpgrades: number;
}

interface CycleSummary {
  cycleNumber: number;
  income: number;
  expenses: number;
  purchases: number;
  netProfit: number;
  balance: number;
  breakdown: CycleBreakdown;
}

export interface StableSummary {
  userId: number;
  cycleRange: [number, number];
  totalIncome: number;
  totalExpenses: number;
  totalPurchases: number;
  netProfit: number;
  cycles: CycleSummary[];
}

// StableMetric shape matches the JSON stored by CycleSnapshotService
interface StableMetric {
  userId: number;
  battlesParticipated: number;
  totalCreditsEarned: number;
  totalPrestigeEarned: number;
  totalRepairCosts: number;
  merchandisingIncome: number;
  streamingIncome: number;
  operatingCosts: number;
  weaponPurchases: number;
  facilityPurchases: number;
  robotPurchases: number;
  attributeUpgrades: number;
  totalPurchases: number;
  netProfit: number;
  balance: number;
}

/**
 * Get the latest cycle number from snapshots.
 */
async function getLatestCycleNumber(): Promise<number | null> {
  const latestSnapshot = await prisma.cycleSnapshot.findFirst({
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });
  return latestSnapshot?.cycleNumber ?? null;
}

/**
 * Build a single cycle's financial summary from a snapshot for a given user.
 */
function buildCycleSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snapshot: any,
  userId: number,
): CycleSummary {
  const userMetrics = (snapshot.stableMetrics as StableMetric[]).find(
    (m: StableMetric) => m.userId === userId,
  );

  if (!userMetrics) {
    return {
      cycleNumber: snapshot.cycleNumber as number,
      income: 0,
      expenses: 0,
      purchases: 0,
      netProfit: 0,
      balance: 0,
      breakdown: {
        battleCredits: 0,
        merchandising: 0,
        streaming: 0,
        repairCosts: 0,
        operatingCosts: 0,
        weaponPurchases: 0,
        facilityPurchases: 0,
        robotPurchases: 0,
        attributeUpgrades: 0,
      },
    };
  }

  const income =
    userMetrics.totalCreditsEarned +
    userMetrics.merchandisingIncome +
    userMetrics.streamingIncome;
  const expenses = userMetrics.totalRepairCosts + userMetrics.operatingCosts;
  const weaponPurchases = Number(userMetrics.weaponPurchases) || 0;
  const facilityPurchases = Number(userMetrics.facilityPurchases) || 0;
  const robotPurchases = Number(userMetrics.robotPurchases) || 0;
  const attributeUpgrades = Number(userMetrics.attributeUpgrades) || 0;
  const purchases = weaponPurchases + facilityPurchases + robotPurchases + attributeUpgrades;

  return {
    cycleNumber: snapshot.cycleNumber as number,
    income,
    expenses,
    purchases,
    netProfit: userMetrics.netProfit,
    balance: userMetrics.balance ?? 0,
    breakdown: {
      battleCredits: userMetrics.totalCreditsEarned,
      merchandising: userMetrics.merchandisingIncome,
      streaming: userMetrics.streamingIncome,
      repairCosts: userMetrics.totalRepairCosts,
      operatingCosts: userMetrics.operatingCosts,
      weaponPurchases,
      facilityPurchases,
      robotPurchases,
      attributeUpgrades,
    },
  };
}

/**
 * Get stable (user) financial summary for the last N cycles.
 */
export async function getStableSummary(
  userId: number,
  lastNCycles: number,
): Promise<StableSummary> {
  const latestCycle = await getLatestCycleNumber();

  if (latestCycle === null) {
    return {
      userId,
      cycleRange: [0, 0],
      totalIncome: 0,
      totalExpenses: 0,
      totalPurchases: 0,
      netProfit: 0,
      cycles: [],
    };
  }

  const startCycle = Math.max(1, latestCycle - lastNCycles + 1);
  const endCycle = latestCycle;

  const snapshots = await cycleSnapshotService.getSnapshotRange(startCycle, endCycle);

  if (snapshots.length === 0) {
    return {
      userId,
      cycleRange: [startCycle, endCycle],
      totalIncome: 0,
      totalExpenses: 0,
      totalPurchases: 0,
      netProfit: 0,
      cycles: [],
    };
  }

  const cycles = snapshots.map((snapshot) => buildCycleSummary(snapshot, userId));

  const totalIncome = cycles.reduce((sum, c) => sum + c.income, 0);
  const totalExpenses = cycles.reduce((sum, c) => sum + c.expenses, 0);
  const totalPurchases = cycles.reduce((sum, c) => sum + c.purchases, 0);
  const netProfit = cycles.reduce((sum, c) => sum + c.netProfit, 0);

  return {
    userId,
    cycleRange: [startCycle, endCycle],
    totalIncome,
    totalExpenses,
    totalPurchases,
    netProfit,
    cycles,
  };
}
