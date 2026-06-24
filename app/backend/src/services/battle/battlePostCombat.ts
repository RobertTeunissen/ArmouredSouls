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
import logger from '../../config/logger';
import { calculateStreamingRevenue, awardStreamingRevenue, StreamingRevenueCalculation } from '../economy/streamingRevenueService';
import { eventLogger, EventType } from '../common/eventLogger';
import { getCurrentCycleNumber } from './baseOrchestrator';
import { achievementService, type AchievementEvent, type UnlockedAchievement } from '../achievement';

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
): Promise<StreamingRevenueCalculation | null> {
  if (isByeMatch) return null;

  const calc = await calculateStreamingRevenue(robotId, userId, false);
  if (!calc) return null;

  // Apply team-size divisor: each teammate gets an equal share
  if (teamSize > 1) {
    calc.totalRevenue = Math.floor(calc.totalRevenue / teamSize);
  }

  const cycleNumber = await getCurrentCycleNumber();
  await awardStreamingRevenue(userId, calc, cycleNumber);

  // Update participant record
  await prisma.battleParticipant.update({
    where: { battleId_robotId: { battleId, robotId } },
    data: { streamingRevenue: calc.totalRevenue },
  });

  return calc;
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
  /** Robot's HP at end of battle. Clamped to stored maxHP internally. */
  finalHP: number;
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
  /** Whether this robot's opponent was destroyed (HP=0) */
  opponentDestroyed: boolean;
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
  // Clamp finalHP to the robot's stored maxHP to prevent currentHP > maxHP
  // (combat uses tuning-inflated maxHP which can exceed the persisted value)
  const storedRobot = await prisma.robot.findUnique({
    where: { id: opts.robotId },
    select: { maxHP: true },
  });
  const clampedHP = storedRobot ? Math.min(opts.finalHP, storedRobot.maxHP) : opts.finalHP;

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
    data.kills = opts.opponentDestroyed ? { increment: 1 } : undefined;
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

  // Clean undefined values so Prisma doesn't complain
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  await prisma.robot.update({
    where: { id: opts.robotId },
    data,
  });
}

// ─── 4–6. Simple Currency / Prestige / Fame Awards ──────────────────

/** Award credits to a user */
export async function awardCreditsToUser(userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { currency: { increment: amount } },
  });
}

/**
 * Award credits to a user with financial ledger recording.
 * Use this when you know the transactionType and cycleNumber.
 */
export async function awardCreditsWithLedger(
  userId: number,
  amount: number,
  transactionType: string,
  cycleNumber: number,
  description: string,
  robotId?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (amount <= 0) return;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { currency: { increment: amount } },
    select: { currency: true },
  });

  // Record to financial ledger (non-blocking — never crash a battle for ledger failure)
  try {
    const financialService = (await import('../financial/financialService')).default;
    await financialService.recordTransaction({
      cycleNumber,
      userId,
      robotId,
      transactionType: transactionType as any,
      amount,
      balanceAfter: updated.currency,
      description,
      metadata,
    });
  } catch (err) {
    // Ledger recording failure must never block gameplay
    const logger = (await import('../../config/logger')).default;
    logger.error(`[BattlePostCombat] Financial ledger record failed for user ${userId}: ${err}`);
  }
}

/** Award prestige to a user */
export async function awardPrestigeToUser(userId: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { prestige: { increment: amount } },
  });
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
    eloDiff: number;
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
