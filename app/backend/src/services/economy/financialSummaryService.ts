/**
 * Dashboard finance summary (`GET /api/finances/summary`): balance, prestige,
 * daily operating costs and passive income. Moved out of `routes/finances.ts`;
 * the response shape is unchanged.
 */
import prisma from '../../lib/prisma';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import {
  calculateDailyPassiveIncome,
  calculateTotalDailyOperatingCosts,
  getPrestigeMultiplier,
} from '../../utils/economyCalculations';
import type { FinancialSummary } from '../../shared/types';

export async function getFinancialSummary(userId: number): Promise<FinancialSummary> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true, prestige: true } });
  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404, { userId });
  }
  const [operatingCosts, passiveIncome] = await Promise.all([
    calculateTotalDailyOperatingCosts(userId),
    calculateDailyPassiveIncome(userId),
  ]);
  return {
    currentBalance: user.currency,
    prestige: user.prestige,
    dailyOperatingCosts: operatingCosts.total,
    dailyPassiveIncome: passiveIncome.total,
    netPassiveIncome: passiveIncome.total - operatingCosts.total,
    prestigeMultiplier: getPrestigeMultiplier(user.prestige),
  };
}
