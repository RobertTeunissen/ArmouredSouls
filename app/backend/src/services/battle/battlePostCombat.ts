/**
 * Shared Post-Combat Helpers
 *
 * Extracts the 6 post-combat pipeline steps that are duplicated across all
 * battle orchestrators into reusable functions:
 *
 *  1. awardStreamingRevenueForBattle()  — calc + award + update participant
 *  2. logBattleAuditEvent()             — one audit event per robot
 *  3. updateRobotCombatStats()          — wins/losses/kills/damage lifetime
 *  4. awardCreditsToUser()              — simple currency increment
 *  5. awardPrestigeToUser()             — simple prestige increment
 *  6. awardFameToRobot()                — simple fame increment
 *  7. checkAndAwardAchievements()       — evaluate + award achievements
 *
 * Each orchestrator still owns its own processBattle() flow, reward formulas,
 * and type-specific DB fields. These helpers just eliminate the copy-paste.
 */

import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { StandingsMode } from '../../../generated/prisma';
import logger from '../../config/logger';
import { calculateStreamingRevenue, awardStreamingRevenue, StreamingRevenueCalculation } from '../economy/streamingRevenueService';
import { eventLogger, EventType } from '../common/eventLogger';
import { getCurrentCycleNumber } from './baseOrchestrator';
import { achievementService, type AchievementEvent, type UnlockedAchievement } from '../achievement';
import { applyCreditMutation, applyCreditMutationInTransaction } from '../financial/creditMutationService';
import { buildBattleIncomeEventId, buildBattlePrestigeEventId } from '../financial/financialEventIdentity';
import { applyPrestigeAward, applyPrestigeAwardInTransaction } from '../financial/prestigeService';
import type {
  BattleIncomeBreakdown,
  PlacementRewardComponent,
  PrestigeAwardBreakdown,
} from '../../types';

// ─── Shared Types ────────────────────────────────────────────────────

/** Per-participant data needed for post-combat processing */
export interface ParticipantOutcome {
  robotId: number;
  userId: number;
  isWinner: boolean;
  isDraw: boolean;
  damageDealt: number;
  finalHP: number;
  yielded: boolean;
  destroyed: boolean;
  /** Credits to award (already calculated by the orchestrator) */
  credits: number;
  /** Prestige to award */
  prestige: number;
  /** Fame to award */
  fame: number;
  /** ELO before battle */
  eloBefore: number;
  /** ELO after battle */
  eloAfter: number;
}

/** Audit event metadata specific to each battle type */
export interface AuditEventExtras {
  [key: string]: unknown;
}

// ─── 1. Streaming Revenue ────────────────────────────────────────────

/**
 * Calculate and award streaming revenue for a single robot in a battle.
 * Updates the BattleParticipant record with the streaming revenue amount.
 *
 * For team battles (tag team, future 3v3/5v5), pass `teamSize` to divide
 * the per-robot revenue evenly across teammates. This keeps team streaming
 * economics consistent regardless of team size:
 *   - Solo (league, tournament, KotH): teamSize = 1 → full revenue
 *   - Tag team (2v2):                  teamSize = 2 → half revenue each
 *   - Future 3v3:                      teamSize = 3 → third revenue each
 *
 * @param teamSize Number of robots on this robot's team (default 1 = solo)
 * @returns The streaming revenue calculation (with adjusted totalRevenue), or null if bye match
 */
export async function awardStreamingRevenueForParticipant(
  robotId: number,
  userId: number,
  battleId: number,
  isByeMatch: boolean = false,
  teamSize: number = 1,
  mode: string = 'unknown',
): Promise<StreamingRevenueCalculation | null> {
  if (isByeMatch) return null;

  const calc = await calculateStreamingRevenue(robotId, userId, false);
  if (!calc) return null;

  // Apply team-size divisor: each teammate gets an equal share
  if (teamSize > 1) {
    calc.totalRevenue = Math.floor(calc.totalRevenue / teamSize);
  }

  const cycleNumber = await getCurrentCycleNumber();
  await awardBattleStreamingRevenue(userId, calc, cycleNumber, battleId, mode);

  // Update participant record
  await prisma.battleParticipant.update({
    where: { battleId_robotId: { battleId, robotId } },
    data: { streamingRevenue: calc.totalRevenue },
  });

  return calc;
}

/**
 * Apply a precomputed per-robot streaming result through the shared
 * Battle_Financial_Reward_Service adapter. Placement modes use the batch
 * calculator, so they pass the same calculation here instead of bypassing
 * the battle financial boundary and calling the economy writer directly.
 */
export async function awardBattleStreamingRevenue(
  userId: number,
  calculation: StreamingRevenueCalculation,
  cycleNumber: number,
  battleId: number,
  mode: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  await awardStreamingRevenue(userId, calculation, cycleNumber, battleId, mode, tx);
}

// ─── 2. Audit Logging ────────────────────────────────────────────────

/**
 * Log a battle_complete audit event for a single robot.
 * All orchestrators emit the same core fields; type-specific extras
 * are merged in via the `extras` parameter.
 */
export async function logBattleAuditEvent(
  participant: ParticipantOutcome,
  battle: { id: number; battleType: string; leagueType: string; durationSeconds: number; eloChange: number },
  opponentId: number | null,
  streamingRevenue: number,
  isByeMatch: boolean,
  extras: AuditEventExtras = {},
): Promise<void> {
  const cycleNumber = await getCurrentCycleNumber();
  const result = participant.isDraw ? 'draw' : (participant.isWinner ? 'win' : 'loss');

  await eventLogger.logEvent(
    cycleNumber,
    EventType.BATTLE_COMPLETE,
    {
      // Battle outcome
      result,
      opponentId,
      isByeMatch,

      // ELO changes
      eloBefore: participant.eloBefore,
      eloAfter: participant.eloAfter,
      eloChange: participant.isWinner ? battle.eloChange : -battle.eloChange,

      // Combat stats
      damageDealt: participant.damageDealt,
      finalHP: participant.finalHP,
      yielded: participant.yielded,
      destroyed: participant.destroyed,

      // Rewards
      credits: participant.credits,
      prestige: participant.prestige,
      fame: participant.fame,
      streamingRevenue,

      // Battle metadata
      battleType: battle.battleType,
      leagueType: battle.leagueType,
      durationSeconds: battle.durationSeconds,

      // Type-specific extras (KotH placement, tag team role, etc.)
      ...extras,
    },
    {
      userId: participant.userId,
      robotId: participant.robotId,
      battleId: battle.id,
    },
  );
}

// ─── 3. Robot Combat Stats ───────────────────────────────────────────

/**
 * Options for updateRobotCombatStats — the SINGLE canonical function
 * that all orchestrators call after a robot participates in any battle.
 *
 * Every orchestrator (1v1 league, 1v1 tournament, 2v2/3v3 league,
 * 2v2/3v3 tournament, tag team, KotH) MUST call this function for
 * each participating robot. This ensures uniform stat tracking.
 */
export interface RobotStatUpdateOptions {
  robotId: number;
  /** Robot's HP at end of battle. Scaled proportionally to stored maxHP internally. */
  finalHP: number;
  /**
   * The maxHP the robot had during combat (after tuning bonuses).
   * Used to proportionally scale finalHP back to stored maxHP.
   * If not provided, falls back to simple clamping.
   */
  combatMaxHP?: number;
  /** New absolute ELO value. Pass current ELO if no change (e.g. KotH). */
  newELO: number;
  /** Whether this robot was on the winning side */
  isWinner: boolean;
  /** Whether the battle ended in a draw */
  isDraw: boolean;
  /** Total damage this robot dealt during the battle */
  damageDealt: number;
  /** Total damage this robot received during the battle */
  damageTakenByOpponent: number;
  /**
   * How many opponents this robot destroyed in this battle.
   *
   * A count, not a flag. A robot faces one opponent in league_1v1 but two or
   * three in team battles and up to nineteen in a Grand Melee, so a boolean
   * capped every multi-opponent mode at one destruction per battle. Derive it
   * with `countKillsByRobot()` from the shared battle statistics module, which
   * attributes each elimination to the robot that caused it.
   */
  opponentsDestroyed: number;
  /** Fame to increment (0 if not winner or no fame) */
  fameIncrement?: number;
  /** Battle type for context (league_1v1, league_2v2, tag_team, koth, etc.) */
  battleType?: string;
  /** Robot's stance at battle time (for stance win counters) */
  stance?: string;
  /** Robot's loadout type at battle time (for loadout win counters) */
  loadoutType?: string;
  /**
   * If true, skip totalBattles/wins/losses/draws increment.
   * Used by KotH where placement determines outcome, not win/loss.
   */
  skipBattleCounters?: boolean;
  /**
   * Finishing position for placement-resolved modes (Grand Melee, KotH).
   *
   * Spec #46 R8 Cause C: `robots.grand_melee_wins` and `grand_melee_top3` existed
   * but nothing ever incremented them, so achievements L26–L30 could not unlock
   * even once their trigger types were registered. Supplying `placement` here
   * lets the shared helper own those counters, per the unified post-battle
   * update rule in `.kiro/steering/project-overview.md`.
   */
  placement?: number;
}

/**
 * Update a robot's combat stats after a battle.
 *
 * This is the SINGLE source of truth for post-battle robot updates.
 * All orchestrators must use this function — no inline prisma.robot.update
 * for combat stat persistence.
 *
 * Handles: currentHP, ELO, totalBattles, wins/losses/draws, kills,
 * damageDealtLifetime, damageTakenLifetime, fame, stance/loadout win counters.
 *
 * LP and streaks are managed separately by the standings service.
 */
export async function updateRobotCombatStats(opts: RobotStatUpdateOptions): Promise<void> {
  // Clamp finalHP to the robot's stored maxHP to prevent currentHP > maxHP.
  // Combat uses tuning-inflated maxHP which can exceed the persisted value,
  // so we scale proportionally: if the robot lost 20% of its combat HP,
  // it loses 20% of its stored HP.
  const storedRobot = await prisma.robot.findUnique({
    where: { id: opts.robotId },
    select: { maxHP: true },
  });

  let clampedHP: number;
  if (storedRobot && opts.combatMaxHP && opts.combatMaxHP > 0) {
    // Proportional scaling: preserve the damage ratio from combat
    const hpRatio = opts.finalHP / opts.combatMaxHP;
    clampedHP = Math.round(storedRobot.maxHP * hpRatio);
  } else {
    // Fallback: simple clamp (no combatMaxHP available)
    clampedHP = storedRobot ? Math.min(opts.finalHP, storedRobot.maxHP) : opts.finalHP;
  }

  const data: Record<string, unknown> = {
    currentHP: clampedHP,
    elo: opts.newELO,
    damageDealtLifetime: { increment: opts.damageDealt },
    damageTakenLifetime: { increment: opts.damageTakenByOpponent },
    fame: (opts.fameIncrement && opts.fameIncrement > 0) ? { increment: opts.fameIncrement } : undefined,
  };

  // Battle counters (skipped for KotH which uses placement, not win/loss)
  if (!opts.skipBattleCounters) {
    data.totalBattles = { increment: 1 };
    data.wins = opts.isWinner ? { increment: 1 } : undefined;
    data.draws = opts.isDraw ? { increment: 1 } : undefined;
    data.losses = (!opts.isWinner && !opts.isDraw) ? { increment: 1 } : undefined;
  }

  // ── Destructions ──
  // Deliberately OUTSIDE the `skipBattleCounters` guard, for the same reason as
  // the Grand Melee counters below: KotH and Grand Melee opt out of the
  // Career_Battle_Counters because a "win" is undefined for a placement, not
  // because their destructions should go unrecorded. While the increment sat
  // inside the guard, the two most destructive modes in the game contributed
  // nothing to `robots.kills`.
  if (opts.opponentsDestroyed > 0) {
    data.kills = { increment: opts.opponentsDestroyed };
  }

  // ── Stance/Loadout Win Counters ──
  if (opts.isWinner && !opts.skipBattleCounters) {
    if (opts.stance === 'offensive') {
      data.offensiveWins = { increment: 1 };
    } else if (opts.stance === 'defensive') {
      data.defensiveWins = { increment: 1 };
    } else if (opts.stance === 'balanced') {
      data.balancedWins = { increment: 1 };
    }

    if (opts.loadoutType === 'dual_wield') {
      data.dualWieldWins = { increment: 1 };
    }
  }

  // ── Grand Melee Mode Counters (Spec #46 R8) ──
  // Deliberately OUTSIDE the `skipBattleCounters` guard. The Grand Melee
  // orchestrator passes `skipBattleCounters: true` to keep the mode out of the
  // Career_Battle_Counters — where a "win" is undefined for placements 2 through
  // 20 and would corrupt the win-rate denominator — not to opt out of its own
  // mode counters.
  if (opts.battleType === 'grand_melee' && opts.placement !== undefined) {
    if (opts.placement === 1) {
      data.grandMeleeWins = { increment: 1 };
    }
    if (opts.placement <= 3) {
      data.grandMeleeTop3 = { increment: 1 };
    }
  }

  // Clean undefined values so Prisma doesn't complain
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  await prisma.robot.update({
    where: { id: opts.robotId },
    data,
  });

  await recordModeKills(opts.robotId, opts.battleType, opts.opponentsDestroyed);
}

/** Battle type strings that map onto a tracked mode, keyed by the string itself. */
const TRACKED_MODES = new Set<string>(Object.values(StandingsMode));

/**
 * Add this battle's destructions to the robot's per-battle-type tally.
 *
 * `robots.kills` is the lifetime total across every mode; this is the same
 * figure split by battle type, so a robot that only subscribes to KotH can be
 * ranked against one that only fights 1v1 league. Every `battleType` an
 * orchestrator passes already matches a `StandingsMode` value exactly.
 *
 * Never throws. A missing tally must not fail a battle that already resolved —
 * the lifetime total on the robot is written above and is unaffected.
 */
async function recordModeKills(
  robotId: number,
  battleType: string | undefined,
  kills: number,
): Promise<void> {
  if (kills <= 0) return;

  if (!battleType || !TRACKED_MODES.has(battleType)) {
    logger.warn(
      `[post-combat] ${kills} destruction(s) by robot ${robotId} not tallied per mode: ` +
      `battleType ${battleType ?? 'undefined'} maps to no StandingsMode`,
    );
    return;
  }

  const mode = battleType as StandingsMode;

  try {
    await prisma.robotModeKills.upsert({
      where: { robotId_mode: { robotId, mode } },
      update: { kills: { increment: kills } },
      create: { robotId, mode, kills },
    });
  } catch (error) {
    logger.error(
      `[post-combat] Failed to tally ${kills} ${mode} destruction(s) for robot ${robotId} — ` +
      `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ─── 4–6. Shared financial/progression/fame awards ──────────────────

export interface BattleCreditAwardOptions {
  sourceEventId?: string;
  battleId?: number;
  mode?: string;
  tier?: number | string;
  outcome?: string;
  placement?: number | null;
  participationFloor?: number;
  winComponent?: number;
  teamSize?: number;
  isBye?: boolean;
  placementRewardComponents?: readonly PlacementRewardComponent[];
  tx?: Prisma.TransactionClient;
}

export interface PrestigeAwardOptions {
  sourceEventId?: string;
  source?: 'battle' | 'achievement';
  mode?: string;
  battleId?: number;
  achievementId?: number;
  tx?: Prisma.TransactionClient;
}

function buildBattleBreakdown(
  amount: number,
  sourceEventId: string,
  options: BattleCreditAwardOptions,
): BattleIncomeBreakdown {
  const placementRewardComponents = options.placementRewardComponents;
  const usesPlacementComponents = placementRewardComponents !== undefined;
  return {
    schemaVersion: 1,
    formula: usesPlacementComponents ? 'battle.placement_income' : 'battle_income',
    formulaVersion: '1',
    inputs: [
      { name: 'participationFloor', value: options.participationFloor ?? amount, unit: 'credits', source: 'battle_reward' },
      { name: 'winComponent', value: options.winComponent ?? 0, unit: 'credits', source: 'battle_reward' },
      { name: 'teamSize', value: options.teamSize ?? 1, unit: 'robots', source: 'battle_context' },
      ...(usesPlacementComponents
        ? [{ name: 'placementRewardTotal', value: amount, unit: 'credits', source: 'per_robot_placement_awards' }]
        : []),
    ],
    modifiers: [],
    rounding: {
      precision: 0,
      mode: 'round',
      operationOrder: usesPlacementComponents
        ? ['perRobotPlacementAwards', 'stableAggregation']
        : ['participationFloor', 'winComponent', 'teamSize'],
      scope: usesPlacementComponents ? 'per_item' : 'aggregate',
    },
    finalAmount: amount,
    sourceEventId,
    transactionType: 'battle_income',
    mode: options.mode ?? 'unknown',
    tier: options.tier ?? 'unknown',
    outcome: options.outcome ?? 'unknown',
    placement: options.placement ?? null,
    participationFloor: options.participationFloor ?? amount,
    winComponent: options.winComponent ?? 0,
    teamSize: options.teamSize ?? 1,
    stableAggregation: 'stable',
    isBye: options.isBye ?? false,
    ...(usesPlacementComponents ? { placementRewardComponents } : {}),
  };
}

/** Compatibility wrapper for callers that only need the shared battle path. */
export async function awardCreditsToUser(userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(
    userId,
    amount,
    'battle_income',
    cycleNumber,
    'Battle reward',
    undefined,
    undefined,
    { mode: 'unknown', outcome: 'unknown' },
  );
}

/** Apply one stable-level battle-income mutation through the atomic pair. */
export async function awardCreditsWithLedger(
  userId: number,
  amount: number,
  transactionType: string,
  cycleNumber: number,
  description: string,
  robotId?: number,
  metadata?: Record<string, unknown>,
  options: BattleCreditAwardOptions = {},
): Promise<void> {
  if (amount <= 0) return;
  if (transactionType !== 'battle_income') {
    throw new Error(`Battle reward cannot use transaction type ${transactionType}`);
  }

  const sourceEventId = options.sourceEventId
    ?? (typeof metadata?.sourceEventId === 'string' ? metadata.sourceEventId : undefined)
    ?? (options.battleId !== undefined
      ? buildBattleIncomeEventId(options.battleId, userId, options.mode ?? 'unknown')
      : `battle:legacy:${cycleNumber}:${userId}:${amount}`);
  const breakdown = buildBattleBreakdown(amount, sourceEventId, options);

  const mutationInput = {
    cycleNumber,
    userId,
    // Battle income is stable-aggregated. The optional robotId remains context
    // for old call sites but is not stored on the stable-level mutation.
    robotId: undefined,
    transactionType: 'battle_income' as const,
    amount,
    description,
    financialEventId: sourceEventId,
    breakdown,
    auditContext: {
      ...(metadata ?? {}),
      participantRobotId: robotId ?? null,
    },
  };
  if (options.tx) {
    await applyCreditMutationInTransaction(options.tx, mutationInput);
  } else {
    await applyCreditMutation(mutationInput);
  }
}

function buildPrestigeBreakdown(
  amount: number,
  sourceEventId: string,
  options: PrestigeAwardOptions,
): PrestigeAwardBreakdown {
  return {
    schemaVersion: 1,
    formula: options.source === 'achievement' ? 'achievement.prestige' : 'battle.prestige',
    formulaVersion: '1',
    inputs: [{ name: 'awardAmount', value: amount, unit: 'prestige', source: options.source ?? 'battle' }],
    modifiers: [],
    rounding: { precision: 0, mode: 'none', operationOrder: ['awardAmount'], scope: 'aggregate' },
    sourceEventId,
    source: options.source ?? 'battle',
    awardAmount: amount,
    mode: options.mode ?? null,
    battleId: options.battleId ?? null,
    achievementId: options.achievementId ?? null,
  };
}

/** Apply one stable-level positive prestige award through Prestige_Service. */
export async function awardPrestigeToUser(
  userId: number,
  amount: number,
  cycleNumber?: number,
  options: PrestigeAwardOptions = {},
): Promise<void> {
  if (amount <= 0) return;
  const actualCycle = cycleNumber ?? await getCurrentCycleNumber();
  const sourceEventId = options.sourceEventId
    ?? (options.source === 'battle' && options.battleId !== undefined && options.mode
      ? buildBattlePrestigeEventId(options.battleId, userId, options.mode)
      : `prestige:legacy:${actualCycle}:${userId}:${amount}`);
  const source = options.source ?? 'battle';
  const breakdown = buildPrestigeBreakdown(amount, sourceEventId, options);

  const mutationInput = {
    cycleNumber: actualCycle,
    userId,
    amount,
    source,
    sourceEventId,
    mode: options.mode,
    battleId: options.battleId,
    achievementId: options.achievementId,
    breakdown,
  };
  if (options.tx) {
    await applyPrestigeAwardInTransaction(options.tx, mutationInput);
  } else {
    await applyPrestigeAward(mutationInput);
  }
}

/** Award fame to a robot */
export async function awardFameToRobot(robotId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  await prisma.robot.update({
    where: { id: robotId },
    data: { fame: { increment: amount } },
  });
}

// ─── 7. Achievement Evaluation ──────────────────────────────────────

/**
 * Check whether a robot lost its most recent completed battle (before the current one).
 * Used for the "I Didn't Hear No Bell" (C15) achievement — win after losing.
 */
export async function didRobotLosePreviousBattle(robotId: number, currentBattleId: number): Promise<boolean> {
  const previousParticipation = await prisma.battleParticipant.findFirst({
    where: {
      robotId,
      battleId: { not: currentBattleId },
    },
    orderBy: { battle: { createdAt: 'desc' } },
    select: {
      battleId: true,
      battle: { select: { winnerId: true } },
    },
  });

  if (!previousParticipation) return false;

  const { winnerId } = previousParticipation.battle;

  // Lost = there was a winner and it wasn't this robot
  return winnerId !== null && winnerId !== robotId;
}

/**
 * Check and award achievements after a battle completes.
 *
 * Wraps achievementService.checkAndAward() with battle-specific event data.
 * Achievement failures MUST NOT block battle processing — wrapped in try-catch.
 *
 * @returns Array of newly unlocked achievements (empty on failure)
 */
export async function checkAndAwardAchievements(
  userId: number,
  robotId: number,
  battleData: {
    won: boolean;
    destroyed: boolean;
    finalHpPercent: number;
    /**
     * The subject robot's own ELO change for this battle.
     *
     * Spec #46 R8 Cause B: this was named `eloDiff`, which the `'elo_upset'`
     * trigger read as though it were the gap to the opponent. `ELO_K_FACTOR` is
     * 32, so the value could never clear the 150 threshold and C11 was
     * unreachable. Renamed so the two cannot be confused again; upset triggers
     * read `subjectEloBefore` and `opponentEloBefore` instead.
     */
    eloChange: number;
    /** Subject's rating before the battle — the upset comparison baseline. */
    subjectEloBefore?: number;
    /** Opponent's rating before the battle. Opponent_Elo_Gap is the difference. */
    opponentEloBefore?: number;
    /** Finishing position in placement-resolved modes (Grand Melee, KotH). */
    placement?: number;
    opponentElo: number;
    yielded: boolean;
    opponentYielded: boolean;
    previousBattleLost: boolean;
    damageDealt: number;
    opponentDamageDealt: number;
    loadoutType: string;
    stance: string;
    yieldThreshold: number;
    hasTuning: boolean;
    hasMainWeapon: boolean;
    battleType: string;
    battleDurationSeconds: number;
    taggedIn?: boolean;
    soloCarry?: boolean;
    minHpPercent?: number;
  },
): Promise<UnlockedAchievement[]> {
  try {
    const event: AchievementEvent = {
      type: 'battle_complete',
      data: battleData as unknown as Record<string, unknown>,
    };
    return await achievementService.checkAndAward(userId, robotId, event);
  } catch (error) {
    logger.error(`Achievement evaluation failed for user ${userId}, robot ${robotId}: ${error}`);
    return [];
  }
}

export type { UnlockedAchievement };
