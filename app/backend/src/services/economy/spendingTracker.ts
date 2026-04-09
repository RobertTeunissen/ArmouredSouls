/**
 * Spending Tracker Service
 * 
 * Tracks spending by category during onboarding for budget comparison.
 * Updates the onboardingChoices.budgetSpent field when purchases are made.
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';

export type SpendingCategory = 'facilities' | 'robots' | 'weapons' | 'attributes';

interface BudgetSpent {
  [key: string]: number;
  facilities: number;
  robots: number;
  weapons: number;
  attributes: number;
}

/**
 * Track spending for a user during onboarding.
 * Only tracks if user hasn't completed onboarding yet.
 * 
 * @param userId - The user ID
 * @param category - The spending category
 * @param amount - The amount spent
 */
export async function trackSpending(
  userId: number,
  category: SpendingCategory,
  amount: number
): Promise<void> {
  try {
    // Get user's onboarding state
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasCompletedOnboarding: true,
        onboardingChoices: true,
      },
    });

    // Only track during onboarding
    if (!user || user.hasCompletedOnboarding) {
      return;
    }

    // Get current choices and budgetSpent
    const choices = (user.onboardingChoices as Record<string, unknown>) || {};
    const currentBudgetSpent = (choices.budgetSpent as BudgetSpent) || {
      facilities: 0,
      robots: 0,
      weapons: 0,
      attributes: 0,
    };

    // Update the category
    const updatedBudgetSpent: BudgetSpent = {
      ...currentBudgetSpent,
      [category]: currentBudgetSpent[category] + amount,
    };

    // Save updated choices
    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingChoices: {
          ...choices,
          budgetSpent: updatedBudgetSpent,
        },
      },
    });

    logger.debug(`[SpendingTracker] User ${userId} | Category: ${category} | Amount: ₡${amount.toLocaleString()} | Total: ₡${updatedBudgetSpent[category].toLocaleString()}`);
  } catch (error) {
    // Don't fail the purchase if tracking fails
    logger.error('Failed to track spending:', error);
  }
}

/**
 * Get current spending for a user.
 * 
 * @param userId - The user ID
 * @returns The budget spent by category, or null if not tracking
 */
export async function getSpending(userId: number): Promise<BudgetSpent | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingChoices: true,
      },
    });

    if (!user) {
      return null;
    }

    const choices = (user.onboardingChoices as Record<string, unknown>) || {};
    return (choices.budgetSpent as BudgetSpent) || {
      facilities: 0,
      robots: 0,
      weapons: 0,
      attributes: 0,
    };
  } catch (error) {
    logger.error('Failed to get spending:', error);
    return null;
  }
}
