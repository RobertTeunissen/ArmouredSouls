/**
 * Robot reference cleanup — shared by every path that deletes robots while
 * their battles stay.
 *
 * Retention rule: when a robot is deleted, its own `battle_participants` rows
 * go with it; the battles, their `battle_summaries` and every other robot's
 * participant rows stay. Durable battle rows outlive participants, so an
 * opponent's record against the deleted robot survives (readers show the
 * missing side as `Unknown`).
 *
 * `battle_participants.robot_id` is a RESTRICT foreign key, so these rows must
 * be removed before the robot is. `team_battle_members.robot_id` cascades since
 * migration 20260829120000, but is deleted explicitly here so the order is
 * stated rather than implied.
 *
 * Used by the Generated_Stable purge (`deleteGeneratedStables`) and the account
 * reset (`performAccountReset`, issue #294).
 *
 * @module services/robot/robotReferenceCleanup
 */
import type { Prisma } from '../../../generated/prisma';

export interface RobotReferenceCleanupResult {
  participantsDeleted: number;
  teamMembershipsDeleted: number;
}

/**
 * Delete the battle participant and team membership rows of the given robots,
 * inside the caller's transaction. Clears by robot id, never by battle, because
 * a deleted robot can share a battle with a surviving one.
 *
 * @param tx - The Prisma transaction client of the deleting transaction
 * @param robotIds - Robots about to be deleted
 * @returns Number of rows deleted per table
 */
export async function deleteRobotBattleReferences(
  tx: Prisma.TransactionClient,
  robotIds: number[],
): Promise<RobotReferenceCleanupResult> {
  if (robotIds.length === 0) {
    return { participantsDeleted: 0, teamMembershipsDeleted: 0 };
  }

  const participants = await tx.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
  const memberships = await tx.teamBattleMember.deleteMany({ where: { robotId: { in: robotIds } } });

  return { participantsDeleted: participants.count, teamMembershipsDeleted: memberships.count };
}
