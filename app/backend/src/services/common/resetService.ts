import prisma from '../../lib/prisma';
import { OnboardingError, OnboardingErrorCode } from '../../errors/onboardingErrors';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
// Spec #45: uploaded images survive an account reset (Image_Library), so this
// service no longer deletes files from storage.

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

  // Check for scheduled matches (unified scheduling table)
  const scheduledMatches = await prisma.scheduledMatchParticipant.count({
    where: {
      participantType: 'robot',
      participantId: { in: robotIds },
      scheduledMatch: { status: 'scheduled' },
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
  const activeTournamentMatches = await prisma.scheduledTournamentMatch.count({
    where: {
      participantType: 'robot',
      OR: [
        { participant1Id: { in: robotIds } },
        { participant2Id: { in: robotIds } },
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
      participants: { some: { robotId: { in: robotIds } } },
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
    throw new OnboardingError(
      OnboardingErrorCode.RESET_BLOCKED,
      `Reset not allowed: ${blockerMessages}`,
      400,
      { blockers: eligibility.blockers }
    );
  }

  // Get current state before reset for logging
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });

  if (!user) {
    throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  const robotsCount = await prisma.robot.count({ where: { userId } });
  const weaponsCount = await prisma.weaponInventory.count({ where: { userId } });
  const facilitiesCount = await prisma.facility.count({ where: { userId } });
  const creditsBeforeReset = user.currency;

  // Perform reset in transaction
  await prisma.$transaction(async (tx) => {
    // Spec #45 R4.7 / R30.19: uploaded images are NOT deleted here. They belong
    // to the player's Image_Library and survive both an account reset and a
    // Season_Rollover, so the player can re-apply their artwork to new robots.
    // Archived seasons also reference these paths.

    // Delete standings for all user's robots (Spec #40 — must happen before robot deletion)
    const userRobotIds = await tx.robot.findMany({
      where: { userId },
      select: { id: true },
    });
    if (userRobotIds.length > 0) {
      await tx.standing.deleteMany({
        where: {
          entityType: 'robot',
          entityId: { in: userRobotIds.map(r => r.id) },
        },
      });
    }

    // Teams and their membership rows go BEFORE the robots.
    //
    // Spec #51: this used to delete the robots first and the teams twenty lines
    // later, with the comment "Teams are removed because their members are gone" —
    // the ordering was exactly backwards. `team_battle_members.robot_id` was
    // RESTRICT, so the robot delete raised a foreign key violation and rolled the
    // whole transaction back: POST /api/onboarding/reset-account failed outright for
    // any player who had ever formed a team. The migration
    // 20260829120000_cascade_team_membership_on_robot_delete makes that constraint
    // cascade, so this ordering is no longer load-bearing, but it is still the
    // correct order to state.
    await tx.teamBattleMember.deleteMany({
      where: { robotId: { in: userRobotIds.map(r => r.id) } },
    });
    await tx.teamBattle.deleteMany({ where: { stableId: userId } });

    // Delete all robots (battle history and team membership cascade)
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

    // Spec #45 R4.10: clear the same competitive state a Season_Rollover clears.
    // Without this, a mid-season reset would wipe assets while preserving
    // prestige and achievements — a competitive advantage the player keeps for
    // free. Teams are deleted above, before the robots they contain.
    await tx.userAchievement.deleteMany({ where: { userId } });

    // Reset user state
    await tx.user.update({
      where: { id: userId },
      data: {
        currency: 3000000, // Reset to starting credits
        // Season-scoped competitive state (Spec #45 R4.10)
        prestige: 0,
        championshipTitles: 0,
        championshipTitles1v1: 0,
        championshipTitles2v2: 0,
        championshipTitles3v3: 0,
        pinnedAchievements: [],
        totalPracticeBattles: 0,
        // Onboarding restart. `lastSeenSeasonNumber` is deliberately untouched
        // so a reset does not re-show the season summary modal (R4.11).
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
