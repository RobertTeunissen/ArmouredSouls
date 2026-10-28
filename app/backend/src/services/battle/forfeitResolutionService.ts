/**
 * Forfeit_Resolution_Writer — the single writer for every two-sided battle-time
 * forfeit (league 1v1, team league 2v2/3v3, tag team, solo and team tournaments).
 *
 * A forfeit is a walkover: a side had a robot without a main weapon when the
 * battle started, so nothing is simulated. The writer reuses the bye machinery:
 * the shared walkover claim, the bye reward amounts (`resolveByeReward`) and the
 * walkover income classification (`isBye: true`, `outcome: 'forfeit_win'`).
 * Callers (one small adapter per orchestrator) compute the mode's normal ELO and
 * LP and hand them in; no orchestrator writes forfeit rows itself.
 *
 * Steps run in the bye module's fixed order — create → claim → pay →
 * participants → summary → standings → stats → audit — so the failure direction
 * is "lost reward, never a duplicate". A claimed queued match whose battle has
 * no `battle_participants` rows is the reconciliation signature of an unpaid
 * forfeit (see FINANCIAL_LEDGER_AUDIT_GUIDE.md).
 *
 * @module services/battle/forfeitResolutionService
 */
import { StandingsMode } from '../../../generated/prisma';
import { encodeBattleLog } from './battleLogCodec';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import { ByeMode, ByeReward, ByeRewardInput, resolveByeReward } from '../../utils/byeRewards';
import { distributeTeamCredits } from '../team-battle/teamBattleRewardService';
import { buildForfeitBattleIncomeEventId } from '../financial/financialEventIdentity';
import standingsService from '../standings/standingsService';
import { computeBattleSummary } from './battleSummaryComputer';
import { awardCreditsWithLedger, logBattleAuditEvent, updateRobotCombatStats } from './battlePostCombat';
import { BYE_BATTLE_DURATION_SECONDS, type ByeParticipant } from './byeResolutionService';
import { claimQueuedMatch, readClaimedBattleId, type WalkoverClaim } from './walkoverClaim';

// ─── Types ───────────────────────────────────────────────────────────────────

/** The two-sided modes. KotH and Grand Melee forfeiters take last place instead. */
export type ForfeitMode = Exclude<ByeMode, 'koth' | 'grand_melee'>;

/** Reason recorded on every forfeit audit row. */
export const FORFEIT_REASON = 'No main weapon equipped';

export interface ForfeitSide {
  side: 1 | 2;
  forfeited: boolean;
  /** Null only for a forfeiting side whose team row no longer exists (team tournament roster forfeit). */
  stableUserId: number | null;
  /** Standing entity, when the mode writes standings (null for tournaments). */
  standingEntity: { entityType: 'robot' | 'team'; entityId: number } | null;
  /** May be empty or short only for a forfeiting side. A ready side always carries its full roster. */
  robots: Array<ByeParticipant & { role?: string | null }>;
}

export interface ForfeitResolutionInput {
  mode: ForfeitMode;
  /** Reward context — the same discriminated input resolveByeReward takes. */
  context: ByeRewardInput;
  claim: WalkoverClaim;
  sides: [ForfeitSide, ForfeitSide];
  /** Caller-computed with the mode's normal ELO formula (A2/A3). */
  newEloByRobotId: Record<number, number>;
  eloChangeBySide: Record<1 | 2, number>;
  /** Caller-supplied with the mode's normal constants. Ignored when standingMode is null. */
  lp: { win: number; loss: number; draw: number };
  standingMode: StandingsMode | null;
  battle: {
    battleType: string;
    leagueType: string;
    leagueInstanceId?: string | null;
    tournamentId?: number | null;
    tournamentRound?: number | null;
    winnerId: number | null;
    winningSide: 1 | 2 | null;
    message: string;
    battleLogExtras?: Record<string, unknown>;
  };
  /** Tournaments only: participant id advancing in the bracket (required for tournament claims). */
  tournamentWinnerId?: number;
  cycleNumber: number;
}

export interface ForfeitResolutionResult {
  /** The battle this forfeit resolved to; on a lost claim, the winner's battle. */
  battleId: number | null;
  creditsPaid: number;
  outcome: 'forfeit_win' | 'double_forfeit';
  /** True when the walkover claim was already taken — nothing was written or paid. */
  alreadyResolved: boolean;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function invalid(message: string, details: Record<string, unknown>): BattleError {
  return new BattleError(BattleErrorCode.INVALID_BATTLE_STATE, message, 500, details);
}

function validate(input: ForfeitResolutionInput): void {
  const forfeiting = input.sides.filter((s) => s.forfeited);
  const details = { mode: input.mode, claim: input.claim };
  if (forfeiting.length === 0) {
    throw invalid('Forfeit resolution requires at least one forfeiting side', details);
  }
  for (const side of input.sides) {
    if (!side.forfeited && (side.stableUserId === null || side.robots.length === 0)) {
      throw invalid(`Ready side ${side.side} needs a stable and its robots`, details);
    }
  }
  if (input.claim.source === 'tournament_match' && input.tournamentWinnerId === undefined) {
    throw invalid('Tournament forfeit requires tournamentWinnerId', details);
  }
  if (forfeiting.length === 2 && (input.battle.winnerId !== null || input.battle.winningSide !== null)) {
    throw invalid('A double forfeit is a draw: winnerId and winningSide must be null', details);
  }
}

// ─── The writer ──────────────────────────────────────────────────────────────

/**
 * Resolve a two-sided forfeit: claim it, pay the ready side, write the record.
 *
 * `awardCreditsWithLedger` writes one FinancialLedger + financial_transaction
 * audit pair through Credit_Mutation_Service; the claim-first order plus the
 * stable `forfeit:` identity make a retry pay nothing.
 */
export async function resolveForfeitEvent(
  input: ForfeitResolutionInput,
): Promise<ForfeitResolutionResult> {
  validate(input);

  const readySide = input.sides.find((s) => !s.forfeited) ?? null;
  const outcome: ForfeitResolutionResult['outcome'] = readySide ? 'forfeit_win' : 'double_forfeit';
  const isDraw = readySide === null;
  // ── 2. Reward: the double forfeit pays nothing ──
  const reward: ByeReward | null = readySide ? resolveByeReward(input.context) : null;
  const credits = reward?.credits ?? 0;

  // ── 3. The battles row ──
  const battleLog = {
    events: [{ timestamp: 0, type: 'forfeit', message: input.battle.message }],
    isForfeit: true,
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
      winningSide: input.battle.winningSide,
      durationSeconds: BYE_BATTLE_DURATION_SECONDS,
      winnerReward: credits,
      loserReward: 0,
      ...(await encodeBattleLog(battleLog)),
    },
  });

  // ── 4. Claim before paying ──
  const tournamentFinalize = input.claim.source === 'tournament_match'
    ? { status: 'forfeit' as const, winnerId: input.tournamentWinnerId as number }
    : undefined;
  const claimed = await claimQueuedMatch(input.claim, battle.id, tournamentFinalize);
  if (!claimed) {
    await prisma.battle.delete({ where: { id: battle.id } }).catch(() => {});
    const winningBattleId = await readClaimedBattleId(input.claim);
    logger.warn(
      `[Forfeit] ${input.mode}: already resolved for ${JSON.stringify(input.claim)}, nothing paid (battle ${winningBattleId})`,
    );
    return { battleId: winningBattleId, creditsPaid: 0, outcome, alreadyResolved: true };
  }

  // ── 5. Pay the ready stable (single forfeit only) ──
  const sourceId = input.claim.source === 'scheduled_match'
    ? input.claim.scheduledMatchId
    : input.claim.tournamentMatchId;
  if (readySide && reward) {
    const stableUserId = readySide.stableUserId as number;
    const tier = 'tier' in input.context ? input.context.tier : 'tournament_round';
    await awardCreditsWithLedger(
      stableUserId,
      reward.credits,
      'battle_income',
      input.cycleNumber,
      `${input.mode} forfeit win reward`,
      undefined,
      { battleId: battle.id, scheduledMatchId: sourceId, isBye: true, forfeit: true },
      {
        battleId: battle.id,
        sourceEventId: buildForfeitBattleIncomeEventId(sourceId, stableUserId, input.mode),
        mode: input.mode,
        tier,
        outcome: 'forfeit_win',
        participationFloor: reward.credits,
        winComponent: 0,
        teamSize: reward.teamSize,
        isBye: true,
      },
    );
  }

  // ── 6. Participant rows: inert, HP untouched ──
  const creditsByRobotId = new Map<number, number>();
  if (readySide) {
    for (const share of distributeTeamCredits(credits, readySide.robots.map((r) => ({ robotId: r.id })))) {
      creditsByRobotId.set(share.robotId, share.credits);
    }
  }
  const eloAfter = (robot: ByeParticipant): number => input.newEloByRobotId[robot.id] ?? robot.elo;
  for (const side of input.sides) {
    for (const robot of side.robots) {
      await prisma.battleParticipant.create({
        data: {
          battleId: battle.id,
          robotId: robot.id,
          team: side.side,
          role: robot.role ?? null,
          credits: creditsByRobotId.get(robot.id) ?? 0,
          streamingRevenue: 0,
          eloBefore: robot.elo,
          eloAfter: eloAfter(robot),
          prestigeAwarded: 0,
          fameAwarded: 0,
          damageDealt: 0,
          finalHP: robot.currentHP,
          yielded: false,
          destroyed: false,
          forfeited: side.forfeited,
        },
      });
    }
  }

  // ── 7. Summary: never fatal ──
  try {
    const robotMaxHP: Record<string, number> = {};
    const robotNameToId: Record<string, number> = {};
    const robotNameToTeam: Record<string, number> = {};
    for (const side of input.sides) {
      for (const robot of side.robots) {
        robotMaxHP[robot.name] = robot.maxHP;
        robotNameToId[robot.name] = robot.id;
        robotNameToTeam[robot.name] = side.side;
      }
    }
    const summary = computeBattleSummary({
      // No combat events: hasData false, totalEvents 0 — nothing was fought.
      events: [],
      duration: BYE_BATTLE_DURATION_SECONDS,
      battleType: input.battle.battleType,
      robotMaxHP,
      robotNameToId,
      robotNameToTeam,
    });
    if (summary) {
      await prisma.battleSummary.create({ data: { battleId: battle.id, ...summary } });
    }
  } catch (err) {
    logger.warn(`[Forfeit] ${input.mode}: battle summary failed for battle ${battle.id}, continuing: ${err}`);
  }

  // ── 8. Standings, when the mode writes them ──
  if (input.standingMode !== null) {
    for (const side of input.sides) {
      if (!side.standingEntity) continue;
      const sideOutcome = isDraw ? 'draw' : side.forfeited ? 'loss' : 'win';
      await standingsService.recordBattleResult({
        entityType: side.standingEntity.entityType,
        entityId: side.standingEntity.entityId,
        mode: input.standingMode,
        outcome: sideOutcome,
        lpDelta: input.lp[sideOutcome],
      });
    }
  }

  // ── 9. Robot stats: a normal win/loss/draw with no combat ──
  for (const side of input.sides) {
    for (const robot of side.robots) {
      await updateRobotCombatStats({
        robotId: robot.id,
        finalHP: robot.currentHP,
        combatMaxHP: robot.maxHP,
        newELO: eloAfter(robot),
        isWinner: !isDraw && !side.forfeited,
        isDraw,
        damageDealt: 0,
        damageTakenByOpponent: 0,
        opponentsDestroyed: 0,
        fameIncrement: 0,
        battleType: input.battle.battleType,
      });
    }
  }

  // ── 10. Audit rows, one per robot, never fatal ──
  for (const side of input.sides) {
    for (const robot of side.robots) {
      try {
        await logBattleAuditEvent(
          {
            robotId: robot.id,
            userId: robot.userId,
            isWinner: !isDraw && !side.forfeited,
            isDraw,
            damageDealt: 0,
            finalHP: robot.currentHP,
            yielded: false,
            destroyed: false,
            credits: creditsByRobotId.get(robot.id) ?? 0,
            prestige: 0,
            fame: 0,
            eloBefore: robot.elo,
            eloAfter: eloAfter(robot),
          },
          {
            id: battle.id,
            battleType: input.battle.battleType,
            leagueType: input.battle.leagueType,
            durationSeconds: BYE_BATTLE_DURATION_SECONDS,
            eloChange: Math.abs(input.eloChangeBySide[side.side]),
          },
          null,
          0,
          false,
          { forfeit: true, forfeited: side.forfeited, forfeitReason: FORFEIT_REASON },
          `battle-complete:${battle.id}:${robot.id}`,
        );
      } catch (err) {
        logger.error(`[Forfeit] ${input.mode}: audit log failed for robot ${robot.id}: ${err}`);
      }
    }
  }

  return { battleId: battle.id, creditsPaid: credits, outcome, alreadyResolved: false };
}
