/**
 * Thin_Instance_Bye_Plan — bye creation for the two Placement_Modes (Spec #49).
 *
 * A KotH or Grand Melee instance whose eligible robot count is below its
 * Minimum_Field_Size cannot run a match. Before Spec #49 the whole instance was
 * skipped with a single log line and nothing was written anywhere: no
 * `scheduled_matches_v2` row, no `battles` row, no Standing update and no audit
 * row. A subscribed robot got nothing on a quiet day in a thin tier, and neither
 * the player nor an operator could see that anything had happened.
 *
 * This module plans one Bye_Event per eligible robot instead. It lives here, not
 * in either matchmaker, so the two cannot drift apart.
 *
 * The plan is separated from its persistence so the planning rules are testable
 * over generated pool sizes with no database.
 *
 * @module services/scheduling/thinInstanceByes
 */

import { $Enums } from '../../../generated/prisma';
import logger from '../../config/logger';
import schedulingService, { CreateScheduledMatchInput } from './schedulingService';

export interface ThinInstanceByeInput {
  matchType: typeof $Enums.MatchType.koth | typeof $Enums.MatchType.grand_melee;
  /** League tier, written to the row's `leagueType`. */
  tier: string;
  leagueInstanceId: string;
  /** Eligible robots — already filtered by the matchmaker's four gates. */
  robots: Array<{ id: number }>;
  scheduledFor: Date;
}

/**
 * Plan the Bye_Events for one Thin_Instance. Pure.
 *
 * One row per byed robot, not one row for the instance: per-robot is what makes
 * Slot_Accounting, the Bye_Award_Claim and resolution all work per robot, and it
 * matches the shape team modes already use for a bye.
 *
 * An empty pool plans nothing, which is what makes the zero-eligible case fall
 * out of the rules rather than needing a special branch.
 */
export function planThinInstanceByes(
  input: ThinInstanceByeInput,
): CreateScheduledMatchInput[] {
  return input.robots.map(robot => ({
    matchType: input.matchType,
    scheduledFor: input.scheduledFor,
    leagueType: input.tier,
    leagueInstanceId: input.leagueInstanceId,
    isByeMatch: true,
    participants: [
      {
        participantType: 'robot' as const,
        participantId: robot.id,
        slot: 1,
      },
    ],
  }));
}

/**
 * Persist the plan through the existing scheduling service.
 *
 * @returns the number of Bye_Events created.
 */
export async function createThinInstanceByes(
  input: ThinInstanceByeInput,
): Promise<number> {
  const plan = planThinInstanceByes(input);

  let created = 0;
  for (const match of plan) {
    try {
      await schedulingService.createMatch(match);
      created++;
    } catch (err) {
      // Per-robot isolation: one failure must not cost the rest of the instance
      // their bye.
      logger.error(
        `[ThinInstanceByes] Failed to create bye for robot ${match.participants[0]?.participantId} in ${input.leagueInstanceId}: ${err}`,
      );
    }
  }

  return created;
}

/**
 * Resolve a Placement_Mode Bye_Event.
 *
 * Lives here rather than in each Placement_Mode orchestrator so there is one
 * implementation, not two. An earlier draft of Spec #49's design put a
 * `resolvePlacementModeBye` adapter in each orchestrator — the same adapter
 * written twice, inside the spec whose purpose is removing duplicated bye logic.
 *
 * `leagueType` follows each mode's existing fought-row convention rather than
 * being made uniform: `kothBattleOrchestrator` writes the literal `'koth'` and
 * `grandMeleeBattleOrchestrator` writes the tier. A bye row that answers existing
 * queries the same way a fought row does is worth more than cosmetic consistency
 * between two bye rows, and the tier is always recoverable from the queued row.
 *
 * No LP, no placement, no `totalMatches` and no ELO: the Bye_Mode_Table declares
 * `standingMode: null` and `updatesElo: false` for both modes, so the writer
 * never calls the Standing or combat-stat paths at all. Not calling is a stronger
 * guarantee than calling with zeroes.
 */
export async function resolvePlacementBye(
  scheduledMatchId: number,
  mode: 'koth' | 'grand_melee',
  robotIds: number[],
  tier?: string,
): Promise<void> {
  // Imported lazily to keep this module free of a battle-service import cycle.
  const { resolveByeEvent } = await import('../battle/byeResolutionService');
  const { getCurrentCycleNumber } = await import('../battle/baseOrchestrator');
  const prisma = (await import('../../lib/prisma')).default;

  const realRobotIds = robotIds.filter(id => id > 0);
  if (realRobotIds.length === 0) return;

  const robots = await prisma.robot.findMany({
    where: { id: { in: realRobotIds } },
    select: { id: true, name: true, userId: true, currentHP: true, maxHP: true, elo: true },
  });
  if (robots.length === 0) return;

  const resolvedTier = tier ?? 'bronze';

  for (const robot of robots) {
    await resolveByeEvent({
      mode,
      context: { mode, tier: resolvedTier },
      claim: { source: 'scheduled_match', scheduledMatchId },
      participants: [robot],
      stableUserId: robot.userId,
      battle: {
        battleType: mode,
        leagueType: mode === 'koth' ? 'koth' : resolvedTier,
        // A Placement_Mode bye produces no placement and no advancement, so
        // there is nothing a winnerId could truthfully mean.
        winnerId: null,
        byeMessage: `${robot.name} receives a bye — too few entrants to run the field`,
      },
      cycleNumber: await getCurrentCycleNumber(),
    });
  }
}
