/**
 * Test Cleanup Helper
 *
 * Provides a centralized cleanup function that handles foreign key constraints
 * in the correct order.
 *
 * Updated for the schema as it stands after Specs #41 and #43 (Backlog #64). What
 * changed, and why the old code no longer compiled:
 *
 * - `scheduled_koth_matches` / `scheduled_koth_match_participants` and
 *   `scheduled_team_battle_matches` were folded into the unified
 *   `scheduled_matches_v2` (`scheduledMatch` + `scheduledMatchParticipant`) by
 *   Spec #41. Participants are rows keyed by `participantType` ('robot' | 'team')
 *   rather than `robot1Id` / `robot2Id` columns.
 * - `battles.robot1_id` / `robot2_id` were dropped by Spec #43. Combatants live in
 *   `battle_participants`.
 *
 * Both `BattleParticipant` and `BattleSummary` declare `onDelete: Cascade` on the
 * battle relation, and `ScheduledMatchParticipant` cascades on the scheduled
 * match, so deleting the parent is sufficient. Deleting children first is not
 * just redundant, it breaks the parent lookup that depends on them.
 */

import prisma from '../src/lib/prisma';
import type { Prisma } from '../generated/prisma';

/**
 * Battles involving any of the given robots.
 *
 * Use this instead of `{ OR: [{ robot1Id: ... }, { robot2Id: ... }] }`. Those
 * columns were dropped by Spec #43; combatants are `battle_participants` rows, and
 * a battle can have more than two of them (2v2, 3v3, KotH, Grand Melee), which the
 * two-column form could never express.
 */
export function battlesForRobots(robotIds: number[]): Prisma.BattleWhereInput {
  return { participants: { some: { robotId: { in: robotIds } } } };
}

/**
 * Queued matches in the unified schedule involving any of the given robots.
 *
 * `scheduled_matches_v2` stores participants as rows with a `participantType`
 * discriminator (Spec #41), so a robot is matched through the join rather than
 * through `robot1Id` / `robot2Id`.
 */
export function scheduledMatchesForRobots(robotIds: number[]): Prisma.ScheduledMatchWhereInput {
  return {
    participants: { some: { participantType: 'robot', participantId: { in: robotIds } } },
  };
}

/** Queued matches booked for any of the given teams (2v2, 3v3, tag team). */
export function scheduledMatchesForTeams(teamIds: number[]): Prisma.ScheduledMatchWhereInput {
  return {
    participants: { some: { participantType: 'team', participantId: { in: teamIds } } },
  };
}

/**
 * Battles involving any robot owned by the given users.
 *
 * Replaces `{ OR: [{ robot1: { userId } }, { robot2: { userId } }] }`.
 * `BattleParticipant` has a real `robot` relation, so this filters in one query.
 */
export function battlesForUsers(userIds: number[]): Prisma.BattleWhereInput {
  return { participants: { some: { robot: { userId: { in: userIds } } } } };
}

/**
 * Robot ids owned by the given users.
 *
 * Needed because the unified schedule cannot be filtered by owner directly:
 * `ScheduledMatchParticipant` is entity-agnostic (a `participantType` plus a bare
 * `participantId`, no foreign key), so there is no `robot` relation to traverse.
 * Resolve ids first, then pass them to `scheduledMatchesForRobots`.
 *
 * Call this before deleting the robots themselves, for obvious reasons.
 */
export async function robotIdsForUsers(userIds: number[]): Promise<number[]> {
  const robots = await prisma.robot.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  return robots.map((r) => r.id);
}

/**
 * Clean up all test data in the correct order to avoid foreign key constraint violations
 *
 * Order matters! Delete in reverse dependency order:
 * 1. Scheduled matches (unified table; participants cascade)
 * 2. Battles (participants and summaries cascade)
 * 3. Team battle members, then team battles
 * 4. Tournament matches, then tournaments
 * 5. Weapon inventory, then robots
 * 6. Facilities, audit logs, cycle snapshots
 * 7. Users
 * 8. Weapons (base data)
 */
export async function cleanupTestData() {
  try {
    // Delete in dependency order
    await prisma.scheduledMatch.deleteMany({});
    await prisma.scheduledTournamentMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.teamBattleMember.deleteMany({});
    await prisma.teamBattle.deleteMany({});
    await prisma.tournament.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});
  } catch (error) {
    console.error('Error during test cleanup:', error);
    throw error;
  }
}

/**
 * Clean up test data for a specific user and their related entities
 */
export async function cleanupUserTestData(userId: number) {
  try {
    // Get all robots for this user
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: { id: true },
    });
    const robotIds = robots.map(r => r.id);

    // Team ids are needed to reach scheduled matches booked for a team rather
    // than for an individual robot.
    const teams = await prisma.teamBattle.findMany({
      where: { stableId: userId },
      select: { id: true },
    });
    const teamIds = teams.map(t => t.id);

    if (robotIds.length > 0 || teamIds.length > 0) {
      await prisma.scheduledMatch.deleteMany({
        where: {
          participants: {
            some: {
              OR: [
                { participantType: 'robot', participantId: { in: robotIds } },
                { participantType: 'team', participantId: { in: teamIds } },
              ],
            },
          },
        },
      });
    }

    if (robotIds.length > 0) {
      await prisma.battle.deleteMany({
        where: { participants: { some: { robotId: { in: robotIds } } } },
      });

      await prisma.teamBattleMember.deleteMany({
        where: { robotId: { in: robotIds } },
      });

      await prisma.weaponInventory.deleteMany({
        where: { userId },
      });
    }

    await prisma.teamBattle.deleteMany({ where: { stableId: userId } });

    await prisma.tournament.deleteMany({ where: { winnerId: userId } });
    await prisma.robot.deleteMany({ where: { userId } });
    await prisma.facility.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    console.error(`Error during user ${userId} cleanup:`, error);
    throw error;
  }
}

export { prisma };
