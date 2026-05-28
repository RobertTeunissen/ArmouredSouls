import prisma from '../../lib/prisma';

/**
 * League: no lock — unsubscribe is instant.
 * Scheduled league matches execute independently of the subscription row.
 * The matchmaker won't re-pair the robot because the subscription is gone.
 */
export async function leagueLockingPredicate(_robotId: number): Promise<boolean> {
  return false;
}

/** Tournament: robot is alive in an active bracket (not eliminated, tournament not completed). */
export async function tournamentLockingPredicate(robotId: number): Promise<boolean> {
  const count = await prisma.scheduledTournamentMatch.count({
    where: {
      status: { in: ['pending', 'scheduled'] },
      tournament: { status: 'active' },
      OR: [{ robot1Id: robotId }, { robot2Id: robotId }],
      winnerId: null,
    },
  });
  return count > 0;
}

/**
 * Tag Team: no lock — unsubscribe is instant.
 * Scheduled tag team matches execute independently of the subscription row.
 * The matchmaker won't re-pair the robot because the subscription is gone.
 */
export async function tagTeamLockingPredicate(_robotId: number): Promise<boolean> {
  return false;
}

/**
 * KotH: no lock — unsubscribe is instant.
 * Scheduled KotH matches execute independently of the subscription row.
 * The matchmaker won't re-pair the robot because the subscription is gone.
 */
export async function kothLockingPredicate(_robotId: number): Promise<boolean> {
  return false;
}
