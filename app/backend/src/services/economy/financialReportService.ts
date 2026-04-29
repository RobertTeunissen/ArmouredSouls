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
} from '../../utils/economyCalculations';

export async function getDailyFinancialReport(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { prestige: true },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
  }

  // Calculate recent battle winnings from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const userRobots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true, totalBattles: true, fame: true },
  });

  const robotIds = userRobots.map(r => r.id);
  let recentBattleWinnings = 0;

  if (robotIds.length > 0) {
    const battles = await prisma.battle.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
    });

    for (const battle of battles) {
      if (battle.winnerId && robotIds.includes(battle.winnerId)) {
        recentBattleWinnings += battle.winnerReward || 0;
      }
      const loserId = battle.winnerId === battle.robot1Id ? battle.robot2Id : battle.robot1Id;
      if (robotIds.includes(loserId)) {
        recentBattleWinnings += battle.loserReward || 0;
      }
    }
  }

  const report = await generateFinancialReport(userId, recentBattleWinnings);
  const passiveIncome = await calculateDailyPassiveIncome(userId);
  const prestigeMultiplier = getPrestigeMultiplier(user.prestige);

  // Merchandising breakdown
  const merchandisingHub = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'merchandising_hub' } },
  });
  const merchandisingHubLevel = merchandisingHub?.level || 0;
  const merchandisingBase = getMerchandisingBaseRate(merchandisingHubLevel);
  const merchandisingMultiplier = 1 + (user.prestige / 10000);

  // Streaming breakdown
  const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
  const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

  const streamingStudio = await prisma.facility.findUnique({
    where: { userId_facilityType: { userId, facilityType: 'streaming_studio' } },
  });
  const streamingStudioLevel = streamingStudio?.level || 0;

  const baseRate = 1000;
  const battleMultiplier = Math.min(1 + (totalBattles / 100) * 0.1, 3.0);
  const fameMultiplier = Math.min(1 + (totalFame / 500) * 0.1, 2.0);
  const studioMultiplier = 1 + (streamingStudioLevel * 1.0);
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
        total: passiveIncome.merchandising,
        formula: `₡${merchandisingBase.toLocaleString()} × ${merchandisingMultiplier.toFixed(2)}`,
      },
      streaming: {
        baseRate,
        battleMultiplier,
        fameMultiplier,
        studioMultiplier,
        totalBattles,
        totalFame,
        total: streamingTotal,
        formula: `₡${baseRate.toLocaleString()} × ${battleMultiplier.toFixed(2)} × ${fameMultiplier.toFixed(2)} × ${studioMultiplier.toFixed(2)}`,
      },
    },
  };
}
