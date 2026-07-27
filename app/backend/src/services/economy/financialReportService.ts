/**
 * Financial Report Service
 *
 * Generates comprehensive daily financial reports with multiplier breakdowns.
 */

import prisma from '../../lib/prisma';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import {
  generateFinancialReport,
  calculateDailyPassiveIncome,
  getPrestigeMultiplier,
  getNextPrestigeTier,
  getMerchandisingBaseRate,
  getRosterCapacity,
} from '../../utils/economyCalculations';
// Spec #46 R10: the Streaming_Revenue_Formula has exactly one implementation.
import { computeStreamingRevenue } from './streamingRevenueService';

export async function getDailyFinancialReport(userId: number) {
  // Parallel group 1: all queries that only depend on userId
  const [user, userRobots, merchandisingHub, streamingStudio, rosterExpansion] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { prestige: true },
    }),
    prisma.robot.findMany({
      where: { userId },
      select: { id: true, name: true, totalBattles: true, fame: true },
    }),
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'merchandising_hub' } },
    }),
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'streaming_studio' } },
    }),
    // Roster_Capacity drives the merchandising multiplier (Spec #46 R2)
    prisma.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'roster_expansion' } },
      select: { level: true },
    }),
  ]);

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
  }

  // Calculate recent battle winnings from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const robotIds = userRobots.map(r => r.id);
  let recentBattleWinnings = 0;

  if (robotIds.length > 0) {
    const battles = await prisma.battle.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        participants: { some: { robotId: { in: robotIds } } },
      },
      include: {
        participants: { where: { robotId: { in: robotIds } }, select: { robotId: true } },
      },
    });

    for (const battle of battles) {
      if (battle.winnerId && robotIds.includes(battle.winnerId)) {
        recentBattleWinnings += battle.winnerReward || 0;
      } else {
        // If the user's robot is not the winner, they're the loser
        const userParticipant = battle.participants.find(p => robotIds.includes(p.robotId));
        if (userParticipant && battle.winnerId !== userParticipant.robotId) {
          recentBattleWinnings += battle.loserReward || 0;
        }
      }
    }
  }

  // Parallel group 2: report generation and passive income are independent
  const [report, passiveIncome] = await Promise.all([
    generateFinancialReport(userId, recentBattleWinnings),
    calculateDailyPassiveIncome(userId),
  ]);
  const prestigeMultiplier = getPrestigeMultiplier(user.prestige);

  // Merchandising breakdown — scales with Prestige_Per_Slot, not raw prestige,
  // so the player can see why their multiplier is what it is (Spec #46 R2.16)
  const merchandisingHubLevel = merchandisingHub?.level || 0;
  const merchandisingBase = getMerchandisingBaseRate(merchandisingHubLevel);
  const rosterCapacity = getRosterCapacity(rosterExpansion?.level ?? 0);
  const prestigePerSlot = user.prestige / rosterCapacity;
  const merchandisingMultiplier = 1 + (prestigePerSlot / 10000);

  // ── Streaming breakdown (Spec #46 R10) ──
  //
  // Two defects lived here, and the Studio Multiplier was absent from the
  // displayed formula string entirely.
  //
  // First, the caps. The display used `min(1 + battles/100 × 0.1, 3.0)` and
  // `min(1 + fame/500 × 0.1, 2.0)`. The divisor arithmetic was in fact
  // equivalent to the award path — `1 + battles/100 × 0.1` is algebraically
  // `1 + battles/1000` — but the award path applies **no cap**, so a robot past
  // 2000 battles or 5000 fame was shown a smaller multiplier than it was paid.
  //
  // Second, and larger: the multipliers were computed against *summed* roster
  // battle count and fame, while streaming is awarded per robot per battle. A
  // five-robot stable saw multipliers built from five robots' combined history,
  // which no individual robot earns.
  //
  // Both are fixed by deriving every figure from `computeStreamingRevenue()`, the
  // same function the award path calls, and by presenting the formula per robot.
  const streamingStudioLevel = streamingStudio?.level || 0;

  const perRobot = userRobots.map((robot) => {
    const breakdown = computeStreamingRevenue(robot.totalBattles, robot.fame, streamingStudioLevel);
    return {
      robotId: robot.id,
      robotName: robot.name,
      battles: robot.totalBattles,
      fame: robot.fame,
      battleMultiplier: breakdown.battleMultiplier,
      fameMultiplier: breakdown.fameMultiplier,
      /** What this robot earns for one battle, at the current studio level. */
      revenuePerBattle: breakdown.totalRevenue,
      formula: `₡${breakdown.baseAmount.toLocaleString()} × ${breakdown.battleMultiplier.toFixed(2)} battles × ${breakdown.fameMultiplier.toFixed(2)} fame × ${breakdown.studioMultiplier.toFixed(2)} studio = ₡${breakdown.totalRevenue.toLocaleString()}`,
    };
  });

  // Roster aggregates, labelled as such rather than fed into a multiplier.
  const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
  const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

  // The headline multipliers describe a representative robot — the roster mean —
  // so the top-level formula reads as a per-robot award. `perRobot` above carries
  // the exact per-robot figures.
  const robotCount = perRobot.length;
  const mean = (pick: (r: typeof perRobot[number]) => number): number =>
    robotCount === 0 ? 1 : perRobot.reduce((sum, r) => sum + pick(r), 0) / robotCount;

  const referenceBreakdown = computeStreamingRevenue(0, 0, streamingStudioLevel);
  const baseRate = referenceBreakdown.baseAmount;
  const battleMultiplier = mean(r => r.battleMultiplier);
  const fameMultiplier = mean(r => r.fameMultiplier);
  const studioMultiplier = referenceBreakdown.studioMultiplier;
  const streamingTotal = report.revenue.streaming || 0;

  return {
    ...report,
    multiplierBreakdown: {
      prestige: {
        current: user.prestige,
        multiplier: prestigeMultiplier,
        bonusPercent: Math.round((prestigeMultiplier - 1) * 100),
        nextTier: getNextPrestigeTier(user.prestige),
      },
      merchandising: {
        baseRate: merchandisingBase,
        prestigeMultiplier: merchandisingMultiplier,
        rosterCapacity,
        prestigePerSlot: Number(prestigePerSlot.toFixed(2)),
        total: passiveIncome.merchandising,
        formula: `₡${merchandisingBase.toLocaleString()} × (1 + ${user.prestige.toLocaleString()} prestige ÷ ${rosterCapacity} slot${rosterCapacity === 1 ? '' : 's'} ÷ 10,000) = ₡${merchandisingBase.toLocaleString()} × ${merchandisingMultiplier.toFixed(2)}`,
      },
      streaming: {
        baseRate,
        battleMultiplier,
        fameMultiplier,
        studioMultiplier,
        /** Roster aggregate, shown as context. Not an input to any multiplier. */
        totalBattles,
        /** Roster aggregate, shown as context. Not an input to any multiplier. */
        totalFame,
        /** Exact per-robot figures. The multipliers above are the roster mean. */
        perRobot,
        /** Aggregate of the per-robot awards actually paid this cycle. */
        total: streamingTotal,
        formula: `₡${baseRate.toLocaleString()} × ${battleMultiplier.toFixed(2)} battles × ${fameMultiplier.toFixed(2)} fame × ${studioMultiplier.toFixed(2)} studio (per robot, per battle)`,
        note: 'Streaming is awarded per robot per battle. The multipliers shown are the roster average; per-robot figures are listed below. The total is the aggregate of the individual awards paid this cycle.',
      },
    },
  };
}
