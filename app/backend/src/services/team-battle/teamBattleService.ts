/**
 * Team Battle Service (CRUD)
 *
 * Manages team registration, member swaps, renames, and disbanding for
 * 2v2 and 3v3 League teams. All mutations use Prisma interactive transactions
 * with row locking to prevent race conditions.
 *
 * @module services/team-battle/teamBattleService
 */

import { TeamBattle } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { safeName } from '../../utils/securityValidation';
import { hasSubscription } from '../subscription/subscriptionService';
import { TeamBattleError, TeamBattleErrorCode } from '../../errors/teamBattleErrors';
import { assignTeamBattleLeagueInstance } from './teamBattleAdapter';

// ── Constants ────────────────────────────────────────────────────────

const VALID_TEAM_SIZES = [2, 3] as const;
const TEAM_NAME_MIN_LENGTH = 3;
const TEAM_NAME_MAX_LENGTH = 32;
const INITIAL_LEAGUE = 'bronze';
const INITIAL_LP = 0;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the event types that allow team formation for a given team size.
 * A robot can form a team if it's subscribed to EITHER the league OR the tournament event.
 */
function getEventTypesForSize(teamSize: 2 | 3): string[] {
  return teamSize === 2
    ? ['league_2v2', 'tournament_2v2']
    : ['league_3v3', 'tournament_3v3'];
}

/**
 * Validates team name against safeName rules and length constraints (3-32 chars).
 */
function validateTeamName(name: string): void {
  if (name.length < TEAM_NAME_MIN_LENGTH || name.length > TEAM_NAME_MAX_LENGTH) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_NAME_INVALID,
      `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`,
      400,
    );
  }

  const result = safeName.safeParse(name);
  if (!result.success) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_NAME_INVALID,
      'Team name contains disallowed characters',
      400,
    );
  }
}

/**
 * Checks if a team is locked for battle (has a scheduled match with status 'scheduled').
 */
async function isTeamLockedForBattle(teamId: number, tx: typeof prisma): Promise<boolean> {
  const count = await tx.scheduledTeamBattleMatch.count({
    where: {
      status: 'scheduled',
      OR: [
        { team1Id: teamId },
        { team2Id: teamId },
      ],
    },
  });
  return count > 0;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register a new team for 2v2 or 3v3 League.
 *
 * Validates:
 * - Team size is 2 or 3
 * - Exactly N distinct robot IDs provided
 * - All robots owned by the stable
 * - All robots subscribed to at least one corresponding team event (league_2v2/tournament_2v2 or league_3v3/tournament_3v3)
 * - No robot already on another team of the same size
 * - Team name passes safeName validation (3-32 chars)
 * - Stable has ≥ N robots
 *
 * Uses Prisma interactive transaction with advisory locks on robot IDs.
 */
export async function registerTeam(
  stableId: number,
  robotIds: number[],
  teamName: string,
  teamSize: 2 | 3,
  _userId: number,
): Promise<TeamBattle> {
  // Validate team size
  if (!VALID_TEAM_SIZES.includes(teamSize)) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_INVALID_SIZE,
      `Team size must be 2 or 3, got ${teamSize}`,
      400,
    );
  }

  // Validate exactly N distinct robot IDs
  const uniqueRobotIds = [...new Set(robotIds)];
  if (uniqueRobotIds.length !== teamSize) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
      `Team of size ${teamSize} requires exactly ${teamSize} distinct robots, got ${uniqueRobotIds.length}`,
      400,
    );
  }

  // Validate team name
  validateTeamName(teamName);

  const team = await prisma.$transaction(async (tx) => {
    // Acquire advisory locks on robot IDs in sorted order to prevent deadlocks.
    // Namespace 2 is reserved for team-battle robot membership checks.
    const sortedIds = [...uniqueRobotIds].sort((a, b) => a - b);
    for (const robotId of sortedIds) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${robotId})`;
    }

    // Validate all robots exist and are owned by the stable
    const robots = await tx.robot.findMany({
      where: { id: { in: uniqueRobotIds } },
      select: { id: true, userId: true, name: true },
    });

    if (robots.length !== teamSize) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `One or more robots not found`,
        400,
      );
    }

    // Ownership check — return generic 403 for all ownership failures (R10.6)
    for (const robot of robots) {
      if (robot.userId !== stableId) {
        throw new TeamBattleError(
          TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
          'Access denied',
          403,
        );
      }
    }

    // Validate stable has ≥ N robots total
    const totalRobots = await tx.robot.count({ where: { userId: stableId } });
    if (totalRobots < teamSize) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INSUFFICIENT_ROBOTS,
        `Stable needs at least ${teamSize} robots to form a team of this size`,
        400,
      );
    }

    // Validate no robot is already on another team of the same size
    const existingMembers = await tx.teamBattleMember.findMany({
      where: {
        robotId: { in: uniqueRobotIds },
        team: { teamSize },
      },
      include: { team: { select: { id: true, teamName: true } } },
    });

    if (existingMembers.length > 0) {
      const conflictRobotId = existingMembers[0].robotId;
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_MEMBER_CONFLICT,
        `Robot ${conflictRobotId} is already on a ${teamSize}v${teamSize} team`,
        400,
      );
    }

    // Assign to proper league instance (scoped by teamSize)
    const leagueId = await assignTeamBattleLeagueInstance(INITIAL_LEAGUE as 'bronze', teamSize);

    // Create the team
    const newTeam = await tx.teamBattle.create({
      data: {
        stableId,
        teamSize,
        teamName,
        teamLp: INITIAL_LP,
        teamLeague: INITIAL_LEAGUE,
        teamLeagueId: leagueId,
        cyclesInLeague: 0,
        totalLeagueWins: 0,
        totalLeagueLosses: 0,
        totalLeagueDraws: 0,
        eligibility: 'ELIGIBLE',
        members: {
          create: uniqueRobotIds.map((robotId, index) => ({
            robotId,
            slotIndex: index,
          })),
        },
      },
      include: { members: true },
    });

    return newTeam;
  });

  logger.info(`[TeamBattle] Created ${teamSize}v${teamSize} team "${teamName}" (id=${team.id}) for stable ${stableId}`);
  return team;
}

/**
 * Swap a team member with a new robot.
 *
 * Rejects if team is locked for battle (has scheduled match).
 * Validates new robot ownership, subscription, and uniqueness (not already on same-size team).
 * Recalculates eligibility after swap.
 */
export async function swapTeamMember(
  teamId: number,
  oldRobotId: number,
  newRobotId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Load team with members
    const team = await tx.teamBattle.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_NOT_FOUND,
        'Team not found',
        404,
      );
    }

    // Ownership check (R10.6)
    if (team.stableId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Check if team is locked for battle
    if (await isTeamLockedForBattle(teamId, tx as unknown as typeof prisma)) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        'Cannot modify team while a battle is scheduled',
        409,
      );
    }

    // Find the member to swap
    const memberToSwap = team.members.find((m) => m.robotId === oldRobotId);
    if (!memberToSwap) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `Robot ${oldRobotId} is not a member of this team`,
        400,
      );
    }

    // Acquire advisory lock on new robot
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${newRobotId})`;

    // Validate new robot exists and is owned by the stable
    const newRobot = await tx.robot.findUnique({
      where: { id: newRobotId },
      select: { id: true, userId: true, name: true },
    });

    if (!newRobot) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        'New robot not found',
        400,
      );
    }

    if (newRobot.userId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Validate new robot is subscribed to at least one team event for this size
    const eventTypes = getEventTypesForSize(team.teamSize as 2 | 3);
    const eventLabel = team.teamSize === 2 ? '2v2 League or 2v2 Tournament' : '3v3 League or 3v3 Tournament';
    let subscribed = false;
    for (const et of eventTypes) {
      if (await hasSubscription(newRobotId, et)) { subscribed = true; break; }
    }
    if (!subscribed) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `"${newRobot.name}" is not subscribed to ${eventLabel}. Subscribe via the Booking Office first.`,
        400,
      );
    }

    // Validate new robot is not already on another team of the same size
    const existingMember = await tx.teamBattleMember.findFirst({
      where: {
        robotId: newRobotId,
        team: { teamSize: team.teamSize },
      },
    });

    if (existingMember) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_MEMBER_CONFLICT,
        `Robot ${newRobotId} is already on a ${team.teamSize}v${team.teamSize} team`,
        400,
      );
    }

    // Perform the swap
    await tx.teamBattleMember.update({
      where: { id: memberToSwap.id },
      data: { robotId: newRobotId },
    });

    // Recalculate eligibility: check all members are subscribed to at least one team event
    const updatedMembers = await tx.teamBattleMember.findMany({
      where: { teamId },
    });

    let eligible = updatedMembers.length === team.teamSize;
    if (eligible) {
      const eligEventTypes = getEventTypesForSize(team.teamSize as 2 | 3);
      for (const member of updatedMembers) {
        let memberSubscribed = false;
        for (const et of eligEventTypes) {
          if (await hasSubscription(member.robotId, et)) { memberSubscribed = true; break; }
        }
        if (!memberSubscribed) {
          eligible = false;
          break;
        }
      }
    }

    await tx.teamBattle.update({
      where: { id: teamId },
      data: { eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE' },
    });
  });

  logger.info(`[TeamBattle] Swapped robot ${oldRobotId} → ${newRobotId} on team ${teamId}`);
}

/**
 * Swap positions of the two members on a 2v2 team (Active ↔ Reserve).
 *
 * Swaps the slotIndex values: slot 0 becomes slot 1 and vice versa.
 * Rejects if team is locked for battle or team is not teamSize=2.
 */
export async function swapPositions(
  teamId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const team = await tx.teamBattle.findUnique({
      where: { id: teamId },
      include: { members: { orderBy: { slotIndex: 'asc' } } },
    });

    if (!team) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_NOT_FOUND,
        'Team not found',
        404,
      );
    }

    if (team.stableId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    if (team.teamSize !== 2) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        'Position swap is only available for 2v2 teams',
        400,
      );
    }

    if (team.members.length !== 2) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        'Team must have exactly 2 members to swap positions',
        400,
      );
    }

    if (await isTeamLockedForBattle(teamId, tx as unknown as typeof prisma)) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        'Cannot modify team while a battle is scheduled',
        409,
      );
    }

    // Swap slot indices: use a temp value to avoid unique constraint violation
    const member0 = team.members[0]; // slotIndex 0
    const member1 = team.members[1]; // slotIndex 1

    // Set member0 to a temp slot (99) to avoid unique constraint on [teamId, slotIndex]
    await tx.teamBattleMember.update({
      where: { id: member0.id },
      data: { slotIndex: 99 },
    });

    // Move member1 to slot 0
    await tx.teamBattleMember.update({
      where: { id: member1.id },
      data: { slotIndex: 0 },
    });

    // Move member0 to slot 1
    await tx.teamBattleMember.update({
      where: { id: member0.id },
      data: { slotIndex: 1 },
    });
  });

  logger.info(`[TeamBattle] Swapped positions on team ${teamId}`);
}

/**
 * Remove a member from a team.
 *
 * Rejects if team is locked for battle.
 * Sets team eligibility to INELIGIBLE (incomplete roster).
 */
export async function removeTeamMember(
  teamId: number,
  robotId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Load team
    const team = await tx.teamBattle.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_NOT_FOUND,
        'Team not found',
        404,
      );
    }

    // Ownership check (R10.6)
    if (team.stableId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Check if team is locked for battle
    if (await isTeamLockedForBattle(teamId, tx as unknown as typeof prisma)) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        'Cannot modify team while a battle is scheduled',
        409,
      );
    }

    // Find the member to remove
    const memberToRemove = team.members.find((m) => m.robotId === robotId);
    if (!memberToRemove) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `Robot ${robotId} is not a member of this team`,
        400,
      );
    }

    // Remove the member
    await tx.teamBattleMember.delete({
      where: { id: memberToRemove.id },
    });

    // Set team to INELIGIBLE (incomplete roster)
    await tx.teamBattle.update({
      where: { id: teamId },
      data: { eligibility: 'INELIGIBLE' },
    });
  });

  logger.info(`[TeamBattle] Removed robot ${robotId} from team ${teamId} — team now INELIGIBLE`);
}

/**
 * Add a member to a team.
 *
 * Validates robot ownership, subscription, and uniqueness.
 * Rejects if team already has N members.
 * If team now has N members, sets eligibility to ELIGIBLE.
 */
export async function addTeamMember(
  teamId: number,
  robotId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Load team with members
    const team = await tx.teamBattle.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_NOT_FOUND,
        'Team not found',
        404,
      );
    }

    // Ownership check (R10.6)
    if (team.stableId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Reject if team already has N members
    if (team.members.length >= team.teamSize) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `Team already has ${team.teamSize} members`,
        400,
      );
    }

    // Acquire advisory lock on robot
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${robotId})`;

    // Validate robot exists and is owned by the stable
    const robot = await tx.robot.findUnique({
      where: { id: robotId },
      select: { id: true, userId: true, name: true },
    });

    if (!robot) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        'Robot not found',
        400,
      );
    }

    if (robot.userId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Validate robot is subscribed to at least one team event for this size
    const eventTypes = getEventTypesForSize(team.teamSize as 2 | 3);
    const eventLabel = team.teamSize === 2 ? '2v2 League or 2v2 Tournament' : '3v3 League or 3v3 Tournament';
    let subscribed = false;
    for (const et of eventTypes) {
      if (await hasSubscription(robotId, et)) { subscribed = true; break; }
    }
    if (!subscribed) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_INVALID_COMPOSITION,
        `"${robot.name}" is not subscribed to ${eventLabel}. Subscribe via the Booking Office first.`,
        400,
      );
    }

    // Validate robot is not already on another team of the same size
    const existingMember = await tx.teamBattleMember.findFirst({
      where: {
        robotId,
        team: { teamSize: team.teamSize },
      },
    });

    if (existingMember) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_MEMBER_CONFLICT,
        `Robot ${robotId} is already on a ${team.teamSize}v${team.teamSize} team`,
        400,
      );
    }

    // Determine next slot index
    const maxSlot = team.members.length > 0
      ? Math.max(...team.members.map((m) => m.slotIndex))
      : -1;
    const nextSlot = maxSlot + 1;

    // Add the member
    await tx.teamBattleMember.create({
      data: {
        teamId,
        robotId,
        slotIndex: nextSlot,
      },
    });

    // If team now has N members, set eligibility to ELIGIBLE
    const newMemberCount = team.members.length + 1;
    if (newMemberCount === team.teamSize) {
      // Verify all members are subscribed to at least one team event before marking eligible
      const allMembers = [...team.members.map((m) => m.robotId), robotId];
      const eligEventTypes = getEventTypesForSize(team.teamSize as 2 | 3);
      let allSubscribed = true;
      for (const memberId of allMembers) {
        let memberSubscribed = false;
        for (const et of eligEventTypes) {
          if (await hasSubscription(memberId, et)) { memberSubscribed = true; break; }
        }
        if (!memberSubscribed) {
          allSubscribed = false;
          break;
        }
      }

      await tx.teamBattle.update({
        where: { id: teamId },
        data: { eligibility: allSubscribed ? 'ELIGIBLE' : 'INELIGIBLE' },
      });
    }
  });

  logger.info(`[TeamBattle] Added robot ${robotId} to team ${teamId}`);
}

/**
 * Rename a team.
 *
 * Validates against safeName (3-32 chars).
 */
export async function renameTeam(
  teamId: number,
  newName: string,
  userId: number,
): Promise<void> {
  // Validate team name
  validateTeamName(newName);

  const team = await prisma.teamBattle.findUnique({
    where: { id: teamId },
    select: { id: true, stableId: true },
  });

  if (!team) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_NOT_FOUND,
      'Team not found',
      404,
    );
  }

  // Ownership check (R10.6)
  if (team.stableId !== userId) {
    throw new TeamBattleError(
      TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
      'Access denied',
      403,
    );
  }

  await prisma.teamBattle.update({
    where: { id: teamId },
    data: { teamName: newName },
  });

  logger.info(`[TeamBattle] Renamed team ${teamId} to "${newName}"`);
}

/**
 * Disband a team.
 *
 * Rejects if team is locked for battle.
 * Deletes team and cascade-deletes members.
 */
export async function disbandTeam(
  teamId: number,
  userId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const team = await tx.teamBattle.findUnique({
      where: { id: teamId },
      select: { id: true, stableId: true, teamName: true },
    });

    if (!team) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_NOT_FOUND,
        'Team not found',
        404,
      );
    }

    // Ownership check (R10.6)
    if (team.stableId !== userId) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_OWNERSHIP_VIOLATION,
        'Access denied',
        403,
      );
    }

    // Check if team is locked for battle
    if (await isTeamLockedForBattle(teamId, tx as unknown as typeof prisma)) {
      throw new TeamBattleError(
        TeamBattleErrorCode.TEAM_LOCKED_FOR_BATTLE,
        'Cannot disband team while a battle is scheduled',
        409,
      );
    }

    // Delete team (members cascade-deleted via onDelete: Cascade in schema)
    await tx.teamBattle.delete({
      where: { id: teamId },
    });
  });

  logger.info(`[TeamBattle] Disbanded team ${teamId}`);
}
