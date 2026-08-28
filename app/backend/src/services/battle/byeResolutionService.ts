/**
 * Bye_Resolution_Writer — the single mechanism by which a Bye_Event resolves.
 *
 * One entry point, `resolveByeEvent`, for all nine modes. Callers supply the
 * identity of the queued match and the few `battles` columns only they know;
 * this module resolves the real entity, asks the Bye_Reward_Calculator for the
 * amounts, claims the award, and writes the whole Bye_Record.
 *
 * Nothing here simulates combat (Spec #49). A bye is a walkover: the opposing
 * side did not turn up, so there is no result to override, no draw to correct,
 * and no damage to persist. Before Spec #49 the team league and tag team paths
 * ran a full simulation against fabricated opponents that punched with the
 * Fists_Fallback, then overwrote the outcome — which billed players to repair a
 * battle nobody fought.
 *
 * There is deliberately no `existingBattleId` parameter. The `battles` row is
 * born here for every mode, so it has exactly one birthplace.
 *
 * @module services/battle/byeResolutionService
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import {
  BYE_MODE_SPECS,
  ByeMode,
  ByeReward,
  ByeRewardInput,
  resolveByeReward,
} from '../../utils/byeRewards';
import { distributeTeamCredits } from '../team-battle/teamBattleRewardService';
import { computeBattleSummary } from './battleSummaryComputer';
import {
  awardCreditsWithLedger,
  logBattleAuditEvent,
  updateRobotCombatStats,
} from './battlePostCombat';
import standingsService from '../standings/standingsService';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Nominal duration for every bye, in seconds.
 *
 * 15 rather than 0 keeps `league_1v1` byes numerically identical to their
 * pre-Spec #49 behaviour and avoids a zero denominator in any downstream
 * per-second rate.
 */
export const BYE_BATTLE_DURATION_SECONDS = 15;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Bye_Award_Claim — the token a Bye_Event must win before any credits are paid.
 *
 * For the six modes queued in `scheduled_matches_v2` the claimed column is
 * `status`; for the three Tournament_Modes it is
 * `scheduled_tournament_matches.battleId`, because bracket advancement has
 * already spent the status token by the time the reward is due.
 */
export type ByeAwardClaim =
  | { source: 'scheduled_match'; scheduledMatchId: number }
  | { source: 'tournament_match'; tournamentMatchId: number };

/** A real participating robot. Never a Bye_Placeholder. */
export interface ByeParticipant {
  id: number;
  name: string;
  userId: number;
  currentHP: number;
  maxHP: number;
  elo: number;
}

export interface ByeResolutionInput {
  mode: ByeMode;
  /** Context for the reward arm this mode reads. */
  context: ByeRewardInput;
  claim: ByeAwardClaim;
  /** Real participants. Resolved by the caller or by `resolveByeParticipants`. */
  participants: ByeParticipant[];
  /** The stable paid the credits — owner of the robot or the team. */
  stableUserId: number;
  /** Columns for the `battles` row that only the caller knows. */
  battle: {
    battleType: string;
    leagueType: string;
    leagueInstanceId?: string | null;
    tournamentId?: number | null;
    tournamentRound?: number | null;
    winnerId: number | null;
    winningSide?: number | null;
    /** Human-readable line for `battleLog.events[0].message`. */
    byeMessage: string;
    /** Extra keys merged into `battleLog` — the tournament block, for instance. */
    battleLogExtras?: Record<string, unknown>;
  };
  /** Standing entity, when the mode writes one. Ignored if `standingMode` is null. */
  standingEntity?: { entityType: 'robot' | 'team'; entityId: number };
  /** New absolute ELO per robot id, for modes where `updatesElo` is true. */
  newEloByRobotId?: Record<number, number>;
  /** ELO delta recorded on the audit row and the battle. */
  eloChange?: number;
  cycleNumber: number;
}

export interface ByeResolutionResult {
  battleId: number | null;
  creditsPaid: number;
  /** True when the Bye_Award_Claim was already taken — nothing was paid. */
  alreadyResolved: boolean;
}

// ─── The claim ───────────────────────────────────────────────────────────────

/**
 * Win the right to pay this Bye_Event, atomically.
 *
 * A single conditional UPDATE. The order is claim-then-pay, always: if the
 * process dies in the window the reward is lost, not duplicated. That is the
 * correct direction — the opposite order turns every crash and retry into a
 * double payment, and both Placement_Mode orchestrators reset `error` rows back
 * to `scheduled` at the end of a run, so a partially-completed pay-then-claim
 * bye would be re-paid on the next cycle.
 *
 * A lost reward is also detectable and repairable: a completed queued row with a
 * `battles` row that has no `battle_participants` rows is an unambiguous
 * signature an operator can query for.
 */
async function claimByeAward(claim: ByeAwardClaim, battleId: number): Promise<boolean> {
  if (claim.source === 'scheduled_match') {
    const { count } = await prisma.scheduledMatch.updateMany({
      where: { id: claim.scheduledMatchId, status: 'scheduled' },
      data: { status: 'completed', battleId },
    });
    return count === 1;
  }

  const { count } = await prisma.scheduledTournamentMatch.updateMany({
    where: { id: claim.tournamentMatchId, battleId: null },
    data: { battleId },
  });
  return count === 1;
}

// ─── The writer ──────────────────────────────────────────────────────────────

/**
 * Resolve a Bye_Event: claim it, write the Bye_Record, pay the credits.
 *
 * Steps run in a fixed order. `awardCreditsWithLedger` uses the module-level
 * Prisma client and takes no transaction client, so the writes are not wrapped
 * in a single `$transaction`; the claim-first ordering is what makes that safe.
 */
export async function resolveByeEvent(
  input: ByeResolutionInput,
): Promise<ByeResolutionResult> {
  const spec = BYE_MODE_SPECS[input.mode];
  const reward: ByeReward = resolveByeReward(input.context);
  const realParticipants = input.participants.filter(p => p.id > 0);

  if (realParticipants.length === 0) {
    logger.warn(`[Bye] ${input.mode}: no real participants, nothing to resolve`);
    return { battleId: null, creditsPaid: 0, alreadyResolved: true };
  }

  // ── 1. The battles row ──
  const battleLog = {
    events: [{ timestamp: 0, type: 'bye_match', message: input.battle.byeMessage }],
    isByeMatch: true,
    detailedCombatEvents: [],
    ...(input.battle.battleLogExtras ?? {}),
  };

  const battle = await prisma.battle.create({
    data: {
      battleType: input.battle.battleType,
      leagueType: input.battle.leagueType,
      leagueInstanceId: input.battle.leagueInstanceId ?? null,
      tournamentId: input.battle.tournamentId ?? null,
      tournamentRound: input.battle.tournamentRound ?? null,
      winnerId: input.battle.winnerId,
      winningSide: input.battle.winningSide ?? null,
      durationSeconds: BYE_BATTLE_DURATION_SECONDS,
      winnerReward: reward.credits,
      loserReward: 0,
      battleLog: battleLog as unknown as Prisma.InputJsonValue,
    },
  });

  // ── 2. Claim before paying ──
  const claimed = await claimByeAward(input.claim, battle.id);
  if (!claimed) {
    await prisma.battle.delete({ where: { id: battle.id } }).catch(() => {});
    logger.warn(
      `[Bye] ${input.mode}: award already claimed for ${JSON.stringify(input.claim)}, nothing paid`,
    );
    return { battleId: null, creditsPaid: 0, alreadyResolved: true };
  }

  // ── 3. Participant rows: inert by construction ──
  const shares = distributeTeamCredits(
    reward.credits,
    realParticipants.map(p => ({ robotId: p.id })),
  );

  for (const p of realParticipants) {
    const newElo = spec.updatesElo ? (input.newEloByRobotId?.[p.id] ?? p.elo) : p.elo;
    await prisma.battleParticipant.create({
      data: {
        battleId: battle.id,
        robotId: p.id,
        team: 1,
        credits: shares.find(s => s.robotId === p.id)?.credits ?? 0,
        streamingRevenue: 0,
        eloBefore: p.elo,
        eloAfter: newElo,
        prestigeAwarded: 0,
        fameAwarded: 0,
        damageDealt: 0,
        // No simulation ran, so HP is exactly what it was.
        finalHP: p.currentHP,
        yielded: false,
        destroyed: false,
      },
    });
  }

  // ── 4. Summary: never fatal ──
  try {
    const robotMaxHP: Record<string, number> = {};
    const robotNameToId: Record<string, number> = {};
    const robotNameToTeam: Record<string, number> = {};
    for (const p of realParticipants) {
      robotMaxHP[p.name] = p.maxHP;
      robotNameToId[p.name] = p.id;
      robotNameToTeam[p.name] = 1;
    }

    const summary = computeBattleSummary({
      // No combat events: hasData resolves to false and totalEvents to 0 for
      // every mode, which is a truthful, queryable marker that nothing was fought.
      events: [],
      duration: BYE_BATTLE_DURATION_SECONDS,
      battleType: input.battle.battleType,
      robotMaxHP,
      robotNameToId,
      robotNameToTeam,
    });

    if (summary) {
      await prisma.battleSummary.create({
        data: { battleId: battle.id, ...summary },
      });
    }
  } catch (err) {
    logger.warn(
      `[Bye] ${input.mode}: battle summary failed for battle ${battle.id}, continuing: ${err}`,
    );
  }

  // ── 5. Standing, only where the mode declares one ──
  if (spec.standingMode && input.standingEntity && reward.lpDelta !== 0) {
    await standingsService.recordBattleResult({
      entityType: input.standingEntity.entityType,
      entityId: input.standingEntity.entityId,
      mode: spec.standingMode,
      outcome: 'win',
      lpDelta: reward.lpDelta,
    });
  }

  // ── 6. ELO, only where the mode declares it ──
  if (spec.updatesElo) {
    for (const p of realParticipants) {
      await updateRobotCombatStats({
        robotId: p.id,
        // The robot's existing HP, never a simulated finalHP.
        finalHP: p.currentHP,
        combatMaxHP: p.maxHP,
        newELO: input.newEloByRobotId?.[p.id] ?? p.elo,
        isWinner: true,
        isDraw: false,
        damageDealt: 0,
        damageTakenByOpponent: 0,
        opponentsDestroyed: 0,
        fameIncrement: 0,
        battleType: input.battle.battleType,
      });
    }
  }

  // ── 7. Pay ──
  await awardCreditsWithLedger(
    input.stableUserId,
    reward.credits,
    'battle_income',
    input.cycleNumber,
    `${input.mode} bye reward`,
  );

  // ── 8. Audit rows, one per real robot, never fatal ──
  for (const p of realParticipants) {
    try {
      await logBattleAuditEvent(
        {
          robotId: p.id,
          userId: p.userId,
          isWinner: true,
          isDraw: false,
          damageDealt: 0,
          finalHP: p.currentHP,
          yielded: false,
          destroyed: false,
          credits: shares.find(s => s.robotId === p.id)?.credits ?? 0,
          prestige: 0,
          fame: 0,
          eloBefore: p.elo,
          eloAfter: spec.updatesElo ? (input.newEloByRobotId?.[p.id] ?? p.elo) : p.elo,
        },
        {
          id: battle.id,
          battleType: input.battle.battleType,
          leagueType: input.battle.leagueType,
          durationSeconds: BYE_BATTLE_DURATION_SECONDS,
          eloChange: input.eloChange ?? 0,
        },
        null,
        0,
        true,
        { byeMode: input.mode },
      );
    } catch (err) {
      logger.error(`[Bye] ${input.mode}: audit log failed for robot ${p.id}: ${err}`);
    }
  }

  return { battleId: battle.id, creditsPaid: reward.credits, alreadyResolved: false };
}
