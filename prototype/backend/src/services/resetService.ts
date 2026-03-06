import prisma from '../lib/prisma';

/**
 * Reset Service
 *
 * Manages account reset functionality for new players who made mistakes during onboarding.
 * Validates reset eligibility, performs account reset with transaction safety,
 * and logs reset events for analytics.
 *
 * @module services/resetService
 */

/**
 * Reset blocker types that prevent account reset
 */
export interface ResetBlocker {
  type: 'scheduled_matches' | 'tournament' | 'pending_battles' | 'facility_construction' | 'pending_transactions';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Reset eligibility result
 */
export interface ResetEligibility {
  eligible: boolean;
  blockers: ResetBlocker[];
}

/**
 * Reset history entry
 */
export interface ResetHistoryEntry {
  id: number;
  userId: number;
  robotsDeleted: number;
  weaponsDeleted: number;
  facilitiesDeleted: number;
  creditsBeforeReset: number;
  reason: string | null;
  resetAt: Date;
}

/**
 * Validate if a user is eligible to reset their account.
 * Checks for scheduled matches, tournament participation, pending battles,
 * active facility construction, and pending transactions.
 *
 * @param userId - The user ID to check eligibility for
 * @returns Reset eligibility result with blockers if any
 *
 * @example
 * const eligibility = await validateResetEligibility(123);
 * if (!eligibility.eligible) {
 *   console.log('Reset blocked:', eligibility.blockers);
 * }
 *
 * Requirements: 14.4, 14.5, 14.6, 14.7, 14.8
 */
export async function validateResetEligibility(userId: number): Promise<ResetEligibility> {
  const blockers: ResetBlocker[] = [];

  // Get user's robots
  const userRobots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
  });

  const robotIds = userRobots.map((r) => r.id);

  if (robotIds.length === 0) {
    // No robots, no blockers
    return { eligible: true, blockers: [] };
  }

  // Check for scheduled matches
  const scheduledMatches = await prisma.scheduledMatch.count({
    where: {
      OR: [
        { robot1Id: { in: robotIds } },
        { robot2Id: { in: robotIds } },
      ],
      status: 'scheduled',
    },
  });

  if (scheduledMatches > 0) {
    blockers.push({
      type: 'scheduled_matches',
      message: 'Cannot reset - you have scheduled battles. Removing robots would create conflicts.',
      details: { count: scheduledMatches },
    });
  }

  // Check for active tournament participation
  const activeTournamentMatches = await prisma.tournamentMatch.count({
    where: {
      OR: [
        { robot1Id: { in: robotIds } },
        { robot2Id: { in: robotIds } },
      ],
      status: { in: ['pending', 'scheduled'] },
    },
  });

  if (activeTournamentMatches > 0) {
    blockers.push({
      type: 'tournament',
      message: 'Cannot reset - you have active tournament participation.',
      details: { count: activeTournamentMatches },
    });
  }

  // Check for pending battle results (battles created but not yet processed)
  // This is a safety check - in normal operation, battles are processed immediately
  const pendingBattles = await prisma.battle.count({
    where: {
      OR: [
        { robot1Id: { in: robotIds } },
        { robot2Id: { in: robotIds } },
      ],
      // Check if battle was created very recently (within last 5 minutes)
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  });

  if (pendingBattles > 0) {
    blockers.push({
      type: 'pending_battles',
      message: 'Cannot reset - you have pending battle results being processed.',
      details: { count: pendingBattles },
    });
  }

  // Check for active facility construction/upgrades
  // Note: Current implementation doesn't have construction time, but this is future-proofing
  // For now, we'll skip this check as facilities are instant

  // Check for pending transactions or trades
  // Note: Current implementation doesn't have a transactions table for pending trades
  // This is future-proofing for when trading is implemented

  return {
    eligible: blockers.length === 0,
    blockers,
  };
}

/**
 * Perform account reset for a user.
 * Deletes all robots, weapons, facilities, resets credits to ₡3,000,000,
 * and resets tutorial state to initial state.
 * All operations are performed in a transaction to ensure atomicity.
 *
 * @param userId - The user ID to reset
 * @param reason - Optional reason for the reset
 * @returns void
 * @throws {Error} If reset is not eligible or database operation fails
 *
 * @example
 * await performAccountReset(123, 'Made poor initial decisions');
 *
 * Requirements: 14.9, 14.10, 14.11, 14.12, 14.13
 */
export async function performAccountReset(userId: number, reason?: string): Promise<void> {
  // Validate eligibility first
  const eligibility = await validateResetEligibility(userId);
  if (!eligibility.eligible) {
    const blockerMessages = eligibility.blockers.map((b) => b.message).join('; ');
    throw new Error(`Reset not allowed: ${blockerMessages}`);
  }

  // Get current state before reset for logging
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const robotsCount = await prisma.robot.count({ where: { userId } });
  const weaponsCount = await prisma.weaponInventory.count({ where: { userId } });
  const facilitiesCount = await prisma.facility.count({ where: { userId } });
  const creditsBeforeReset = user.currency;

  // Perform reset in transaction
  await prisma.$transaction(async (tx) => {
    // Delete all robots (cascade will handle battle history)
    await tx.robot.deleteMany({
      where: { userId },
    });

    // Delete all weapon inventory
    await tx.weaponInventory.deleteMany({
      where: { userId },
    });

    // Delete all facilities
    await tx.facility.deleteMany({
      where: { userId },
    });

    // Delete all tag teams (if any)
    await tx.tagTeam.deleteMany({
      where: { stableId: userId },
    });

    // Reset user state
    await tx.user.update({
      where: { id: userId },
      data: {
        currency: 3000000, // Reset to starting credits
        hasCompletedOnboarding: false,
        onboardingSkipped: false,
        onboardingStep: 1,
        onboardingStrategy: null,
        onboardingChoices: {},
        onboardingStartedAt: new Date(),
        onboardingCompletedAt: null,
      },
    });

    // Log reset event
    await tx.resetLog.create({
      data: {
        userId,
        robotsDeleted: robotsCount,
        weaponsDeleted: weaponsCount,
        facilitiesDeleted: facilitiesCount,
        creditsBeforeReset,
        reason: reason || null,
      },
    });
  });
}

/**
 * Get reset history for a user.
 * Returns all previous reset events for analytics and debugging.
 *
 * @param userId - The user ID to get reset history for
 * @returns Array of reset history entries
 *
 * @example
 * const history = await getResetHistory(123);
 * console.log(`User has reset ${history.length} times`);
 *
 * Requirements: 14.13
 */
export async function getResetHistory(userId: number): Promise<ResetHistoryEntry[]> {
  const resetLogs = await prisma.resetLog.findMany({
    where: { userId },
    orderBy: { resetAt: 'desc' },
  });

  return resetLogs.map((log) => ({
    id: log.id,
    userId: log.userId,
    robotsDeleted: log.robotsDeleted,
    weaponsDeleted: log.weaponsDeleted,
    facilitiesDeleted: log.facilitiesDeleted,
    creditsBeforeReset: Number(log.creditsBeforeReset),
    reason: log.reason,
    resetAt: log.resetAt,
  }));
}
