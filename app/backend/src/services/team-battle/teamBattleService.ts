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
import { TeamBattleError, TeamBattleErrorCode } from '../../errors/teamBattleErrors';
import { ensureTeamStandings, lockTeamStandings } from '../standings/standingPlacement';

// ── Constants ────────────────────────────────────────────────────────

const VALID_TEAM_SIZES = [2, 3] as const;
const TEAM_NAME_MIN_LENGTH = 3;
const TEAM_NAME_MAX_LENGTH = 32;

// ── Helpers ──────────────────────────────────────────────────────────

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
 * Checks if a team is locked for battle (has a scheduled match in the unified table).
 * Filters by appropriate match types based on team membership.
 */
async function isTeamLockedForBattle(teamId: number, tx: typeof prisma): Promise<boolean> {
  const count = await tx.scheduledMatchParticipant.count({
    where: {
      participantType: 'team',
      participantId: teamId,
      scheduledMatch: {
        status: 'scheduled',
      },
    },
  });
  return count > 0;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register a new team of 2 or 3 robots.
 *
 * Validates:
 * - Team size is 2 or 3
 * - Exactly N distinct robot IDs provided
 * - All robots owned by the stable
 * - No robot already on another team of the same size
 * - Team name passes safeName validation (3-32 chars)
 * - Stable has ≥ N robots
 *
 * No subscription is required to form a team. The team enters a mode's Bronze
 * league (gets its standings row) once it is complete and every member holds
 * that mode's subscription; `ensureTeamStandings` checks this inside the
 * transaction, so a team whose robots are already subscribed is placed at once.
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

    // Create the team
    const newTeam = await tx.teamBattle.create({
      data: {
        stableId,
        teamSize,
        teamName,
        members: {
          create: uniqueRobotIds.map((robotId, index) => ({
            robotId,
            slotIndex: index,
          })),
        },
      },
      include: { members: true },
    });

    // Place the team in every team mode all its members already hold. The
    // (2, robotId) locks above precede the team lock this takes (lock order).
    await ensureTeamStandings(tx, newTeam.id);

    return newTeam;
  });

  logger.info(`[TeamBattle] Created ${teamSize}v${teamSize} team "${teamName}" (id=${team.id}) for stable ${stableId}`);
  return team;
}

/**
 * Swap a team member with a new robot.
 *
 * Rejects if team is locked for battle (has scheduled match).
 * Validates new robot ownership and uniqueness (not already on a same-size
 * team). No subscription is required: the team keeps its id, tier and LP, and
 * enters any mode it becomes matchable in (complete, every member holding that
 * mode's subscription) via `ensureTeamStandings`.
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

    // Take (5, teamId) before writing the member row. Disband holds this lock
    // while it deletes the team (cascading to members); taking it after the
    // update would let swap and disband deadlock on the member row.
    await lockTeamStandings(tx, teamId);

    // Perform the swap
    await tx.teamBattleMember.update({
      where: { id: memberToSwap.id },
      data: { robotId: newRobotId },
    });

    // The new line-up may complete a mode's subscription set. The team lock
    // is already held; re-taking it here is a no-op (advisory locks re-enter).
    await ensureTeamStandings(tx, teamId);
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
 * Takes the `(5, teamId)` team-standing lock, deletes the team's standings rows
 * (polymorphic, no foreign key), then the team; members cascade-delete. A team
 * registered later starts again in Bronze.
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

    // (5, teamId) serialises this delete with every team-standing check: a
    // member subscription either commits its team row before the delete reads,
    // or waits and then finds the team gone. Without it the row is orphaned.
    await lockTeamStandings(tx, teamId);

    // standings has no FK to team_battles, so remove the team's rows first.
    await tx.standing.deleteMany({ where: { entityType: 'team', entityId: teamId } });

    // Delete team (members cascade-deleted via onDelete: Cascade in schema)
    await tx.teamBattle.delete({
      where: { id: teamId },
    });
  });

  logger.info(`[TeamBattle] Disbanded team ${teamId}`);
}
