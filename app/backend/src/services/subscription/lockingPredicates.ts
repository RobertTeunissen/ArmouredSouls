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

/**
 * 2v2 League: locked when the robot's team has a scheduled match.
 * Prevents unsubscription while a team battle is queued.
 */
export async function league2v2LockingPredicate(robotId: number): Promise<boolean> {
  const count = await prisma.scheduledTeamBattleMatch.count({
    where: {
      status: 'scheduled',
      teamSize: 2,
      OR: [
        { team1: { members: { some: { robotId } } } },
        { team2: { members: { some: { robotId } } } },
      ],
    },
  });
  return count > 0;
}

/**
 * 3v3 League: locked when the robot's team has a scheduled match.
 * Prevents unsubscription while a team battle is queued.
 */
export async function league3v3LockingPredicate(robotId: number): Promise<boolean> {
  const count = await prisma.scheduledTeamBattleMatch.count({
    where: {
      status: 'scheduled',
      teamSize: 3,
      OR: [
        { team1: { members: { some: { robotId } } } },
        { team2: { members: { some: { robotId } } } },
      ],
    },
  });
  return count > 0;
}
