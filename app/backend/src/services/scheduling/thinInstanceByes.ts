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

import { $Enums, Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import type { KothPlacement } from '../../types';
import type { ByeParticipant } from '../battle/byeResolutionService';
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

/** The scheduled row fields a below-minimum resolution needs. */
export interface BelowMinimumMatch {
  id: number;
  /** The match tier (both placement modes store it in `leagueType`). */
  leagueType: string | null;
  leagueInstanceId: string | null;
  scheduledFor: Date;
}

export interface BelowMinimumResult {
  /** The forfeit-only battle, or null when there were no forfeiters (or the claim was lost). */
  forfeitBattleId: number | null;
  /** The per-robot bye rows created for the ready robots. */
  byeMatchIds: number[];
  /** True when another process already resolved the match: nothing was written. */
  alreadyResolved: boolean;
}

/**
 * Resolve a placement match whose READY field fell below the mode's minimum at
 * battle time (design §5.8, rule 4).
 *
 * Unready robots (no main weapon) take the bottom placements in one forfeit-only
 * battle with no winner and no rewards; their 0-point loss is still recorded.
 * Every ready robot gets a tier-scaled bye, exactly as a thin instance would at
 * scheduling time. Shared by KotH and Grand Melee so the two cannot drift.
 *
 * Claim-first, like the bye module: the bare battle row is written, then the
 * original match is claimed and the bye rows created in one transaction, and
 * only then are participants, summary, standings and audit written. A crash
 * leaves at worst an orphan bare battle (no participants, invisible in history)
 * or claimable bye rows that the next run's bye branch resolves at the same tier.
 *
 * @param ready - robots that can fight, fewer than the minimum
 * @param forfeited - robots without a main weapon, placed last in ascending id order
 */
export async function resolveBelowMinimumField(
  match: BelowMinimumMatch,
  mode: 'koth' | 'grand_melee',
  ready: ByeParticipant[],
  forfeited: ByeParticipant[],
): Promise<BelowMinimumResult> {
  // Never invent an instance id for the bye rows: fail before any write.
  if (ready.length > 0 && match.leagueInstanceId === null) {
    throw new BattleError(
      BattleErrorCode.INVALID_BATTLE_STATE,
      `${mode} match ${match.id}: cannot create byes without a league instance`,
      500,
      { matchId: match.id, mode },
    );
  }

  // Imported lazily to keep this module free of a battle-service import cycle.
  const prisma = (await import('../../lib/prisma')).default;
  const { BYE_BATTLE_DURATION_SECONDS } = await import('../battle/byeResolutionService');
  const { computeBattleSummary } = await import('../battle/battleSummaryComputer');
  const { logBattleAuditEvent } = await import('../battle/battlePostCombat');
  const standingsService = (await import('../standings/standingsService')).default;

  const tier = match.leagueType ?? 'bronze';
  const battleLeagueType = mode === 'koth' ? 'koth' : tier;
  const totalParticipants = ready.length + forfeited.length;
  const placed = [...forfeited]
    .sort((a, b) => a.id - b.id)
    .map((robot, i) => ({ robot, placement: ready.length + 1 + i }));

  // ── 1. Bare forfeit-only battle row (no participants yet) ──
  let forfeitBattleId: number | null = null;
  if (placed.length > 0) {
    const message = `${placed.map((p) => p.robot.name).join(', ')} forfeited — no main weapon equipped`;
    const battle = await prisma.battle.create({
      data: {
        battleType: mode,
        leagueType: battleLeagueType,
        winnerId: null,
        durationSeconds: BYE_BATTLE_DURATION_SECONDS,
        winnerReward: 0,
        loserReward: 0,
        battleLog: {
          events: [{ timestamp: 0, type: 'forfeit', message }],
          isForfeit: true,
          detailedCombatEvents: [],
        } as unknown as Prisma.InputJsonValue,
      },
    });
    forfeitBattleId = battle.id;
  }
  const deleteBareRow = async (): Promise<void> => {
    if (forfeitBattleId === null) return;
    await prisma.battle.delete({ where: { id: forfeitBattleId } }).catch(() => {});
  };

  // ── 2. Claim the original match and create the per-robot bye rows ──
  const plan = ready.length > 0
    ? planThinInstanceByes({
      matchType: mode,
      tier,
      leagueInstanceId: match.leagueInstanceId as string,
      robots: ready,
      scheduledFor: match.scheduledFor,
    })
    : [];
  let claim: { claimed: boolean; byes: Array<{ id: number; robotId: number }> };
  try {
    claim = await prisma.$transaction(async (tx) => {
      const claimed = await tx.scheduledMatch.updateMany({
        where: { id: match.id, status: 'scheduled' },
        data: { status: 'completed', battleId: forfeitBattleId },
      });
      if (claimed.count !== 1) return { claimed: false, byes: [] };
      const byes: Array<{ id: number; robotId: number }> = [];
      for (const bye of plan) {
        const row = await tx.scheduledMatch.create({
          data: {
            matchType: bye.matchType,
            scheduledFor: bye.scheduledFor,
            status: 'scheduled',
            leagueType: bye.leagueType ?? null,
            leagueInstanceId: bye.leagueInstanceId ?? null,
            isByeMatch: true,
            participants: { create: bye.participants },
          },
          select: { id: true },
        });
        byes.push({ id: row.id, robotId: bye.participants[0].participantId });
      }
      return { claimed: true, byes };
    });
  } catch (err) {
    await deleteBareRow();
    throw err;
  }
  if (!claim.claimed) {
    await deleteBareRow();
    logger.warn(`[ThinInstanceByes] ${mode} match ${match.id}: already resolved, below-minimum resolution skipped`);
    return { forfeitBattleId: null, byeMatchIds: [], alreadyResolved: true };
  }

  if (forfeitBattleId !== null) {
    const battleId = forfeitBattleId;
    // ── 3. Forfeiter participants (HP untouched) + empty summary ──
    await prisma.battleParticipant.createMany({
      data: placed.map(({ robot, placement }) => ({
        battleId,
        robotId: robot.id,
        team: 1,
        placement,
        role: null,
        credits: 0,
        streamingRevenue: 0,
        eloBefore: robot.elo,
        eloAfter: robot.elo,
        prestigeAwarded: 0,
        fameAwarded: 0,
        damageDealt: 0,
        finalHP: robot.currentHP,
        yielded: false,
        destroyed: false,
        forfeited: true,
      })),
    });
    try {
      const robotMaxHP: Record<string, number> = {};
      const robotNameToId: Record<string, number> = {};
      const robotNameToTeam: Record<string, number> = {};
      for (const { robot } of placed) {
        robotMaxHP[robot.name] = robot.maxHP;
        robotNameToId[robot.name] = robot.id;
        robotNameToTeam[robot.name] = 1;
      }
      const kothPlacements: KothPlacement[] = placed.map(({ robot, placement }) => ({
        robotId: robot.id,
        robotName: robot.name,
        placement,
        zoneScore: 0,
        zoneTime: 0,
        kills: 0,
        destroyed: false,
        forfeited: true,
      }));
      const summary = computeBattleSummary({
        events: [],
        duration: BYE_BATTLE_DURATION_SECONDS,
        battleType: mode,
        robotMaxHP,
        robotNameToId,
        robotNameToTeam,
        kothPlacements,
      });
      if (summary) await prisma.battleSummary.create({ data: { battleId, ...summary } });
    } catch (err) {
      logger.warn(`[ThinInstanceByes] ${mode} match ${match.id}: battle summary failed for battle ${battleId}, continuing: ${err}`);
    }

    // ── 4. Standings: a 0-point placement that still counts as a match ──
    for (const { robot, placement } of placed) {
      if (mode === 'koth') {
        await standingsService.awardKothPoints({
          robotId: robot.id, placement, totalParticipants, zoneScore: 0, zoneTime: 0, forfeited: true,
        });
      } else {
        await standingsService.awardGrandMeleePoints({
          robotId: robot.id, placement, totalParticipants, damageDealt: 0, survivalTime: 0, forfeited: true,
        });
      }
    }

    // ── 5. Audit, one battle_complete row per forfeiter, never fatal ──
    for (const { robot, placement } of placed) {
      try {
        await logBattleAuditEvent(
          {
            robotId: robot.id,
            userId: robot.userId,
            isWinner: false,
            isDraw: false,
            damageDealt: 0,
            finalHP: robot.currentHP,
            yielded: false,
            destroyed: false,
            credits: 0,
            prestige: 0,
            fame: 0,
            eloBefore: robot.elo,
            eloAfter: robot.elo,
          },
          { id: battleId, battleType: mode, leagueType: battleLeagueType, durationSeconds: BYE_BATTLE_DURATION_SECONDS, eloChange: 0 },
          null,
          0,
          false,
          { kothPlacement: placement, forfeit: true },
          `battle-complete:${battleId}:${robot.id}`,
        );
      } catch (err) {
        logger.error(`[ThinInstanceByes] ${mode} match ${match.id}: audit log failed for robot ${robot.id}: ${err}`);
      }
    }
  }

  // ── 6. Byes, through the existing claim-first bye path at the match tier ──
  for (const bye of claim.byes) {
    await resolvePlacementBye(bye.id, mode, [bye.robotId], tier);
  }

  logger.info(
    `[ThinInstanceByes] ${mode} match ${match.id}: below minimum (${ready.length} ready, ${placed.length} forfeited) → `
    + `forfeit battle ${forfeitBattleId ?? 'none'}, ${claim.byes.length} byes`,
  );
  return { forfeitBattleId, byeMatchIds: claim.byes.map((b) => b.id), alreadyResolved: false };
}
