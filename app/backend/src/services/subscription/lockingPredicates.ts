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
      participantType: 'robot',
      status: { in: ['pending', 'scheduled'] },
      tournament: { status: 'active' },
      OR: [{ participant1Id: robotId }, { participant2Id: robotId }],
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

/**
 * 2v2 Tournament: locked when the robot's team has a pending/scheduled match
 * in an active 2v2 tournament.
 */
export async function tournament2v2LockingPredicate(robotId: number): Promise<boolean> {
  // Find teams this robot belongs to (any team size — the robot could be in a 2v2 team)
  const memberships = await prisma.teamBattleMember.findMany({
    where: { robotId },
    select: { teamId: true },
  });
  if (memberships.length === 0) return false;

  const teamIds = memberships.map(m => m.teamId);

  // Check if any of these teams have pending/scheduled matches in active 2v2 tournaments
  const count = await prisma.scheduledTournamentMatch.count({
    where: {
      participantType: 'team_2v2',
      status: { in: ['pending', 'scheduled'] },
      tournament: { status: 'active' },
      OR: [
        { participant1Id: { in: teamIds } },
        { participant2Id: { in: teamIds } },
      ],
    },
  });
  return count > 0;
}

/**
 * 3v3 Tournament: locked when the robot's team has a pending/scheduled match
 * in an active 3v3 tournament.
 */
export async function tournament3v3LockingPredicate(robotId: number): Promise<boolean> {
  // Find teams this robot belongs to (any team size — the robot could be in a 3v3 team)
  const memberships = await prisma.teamBattleMember.findMany({
    where: { robotId },
    select: { teamId: true },
  });
  if (memberships.length === 0) return false;

  const teamIds = memberships.map(m => m.teamId);

  // Check if any of these teams have pending/scheduled matches in active 3v3 tournaments
  const count = await prisma.scheduledTournamentMatch.count({
    where: {
      participantType: 'team_3v3',
      status: { in: ['pending', 'scheduled'] },
      tournament: { status: 'active' },
      OR: [
        { participant1Id: { in: teamIds } },
        { participant2Id: { in: teamIds } },
      ],
    },
  });
  return count > 0;
}
