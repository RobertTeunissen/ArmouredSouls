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

/** Options for updateRobotCombatStats — covers all orchestrator variations */
export interface RobotStatUpdateOptions {
  robotId: number;
  finalHP: number;
  newELO: number;
  isWinner: boolean;
  isDraw: boolean;
  damageDealt: number;
  damageTakenByOpponent: number;
  opponentDestroyed: boolean;
  /** League points change (0 for tournament/KotH) */
  leaguePointsChange?: number;
  /** Current league points on the robot (needed for min-0 clamping) */
  currentLeaguePoints?: number;
  /** Fame to increment (0 if not winner or no fame) */
  fameIncrement?: number;
  /** Additional fields for type-specific stat updates */
  extraData?: Record<string, unknown>;
  /** Battle type for streak tracking (only 'league' battles affect league streaks) */
  battleType?: string;
  /** Robot's stance at battle time (for stance win counters) */
  stance?: string;
  /** Robot's loadout type at battle time (for loadout win counters) */
  loadoutType?: string;
}

/**
 * Update a robot's combat stats after a battle.
 * Handles wins/losses/draws/kills/damage lifetime counters + ELO + HP + LP.
 */
export async function updateRobotCombatStats(opts: RobotStatUpdateOptions): Promise<void> {
  const lpChange = opts.leaguePointsChange ?? 0;
  const currentLP = opts.currentLeaguePoints ?? 0;

  const data: Record<string, unknown> = {
    currentHP: opts.finalHP,
    elo: opts.newELO,
    totalBattles: { increment: 1 },
    wins: opts.isWinner ? { increment: 1 } : undefined,
    draws: opts.isDraw ? { increment: 1 } : undefined,
    losses: (!opts.isWinner && !opts.isDraw) ? { increment: 1 } : undefined,
    kills: opts.opponentDestroyed ? { increment: 1 } : undefined,
    damageDealtLifetime: { increment: opts.damageDealt },
    damageTakenLifetime: { increment: opts.damageTakenByOpponent },
    fame: (opts.fameIncrement && opts.fameIncrement > 0) ? { increment: opts.fameIncrement } : undefined,
  };

  // Apply league points if applicable
  if (lpChange !== 0) {
    data.leaguePoints = Math.max(0, currentLP + lpChange);
  }

  // ── League Win/Lose Streak Tracking ──
  if (opts.battleType === 'league') {
    if (opts.isWinner) {
      // Win: increment win streak, reset lose streak
      data.currentWinStreak = { increment: 1 };
      data.currentLoseStreak = 0;
    } else if (opts.isDraw) {
      // Draw: reset both streaks
      data.currentWinStreak = 0;
      data.currentLoseStreak = 0;
    } else {
      // Loss: reset win streak, increment lose streak
      data.currentWinStreak = 0;
      data.currentLoseStreak = { increment: 1 };
    }
  }

  // ── Stance/Loadout Win Counters ──
  if (opts.isWinner) {
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

  // Merge any type-specific extra fields
  if (opts.extraData) {
    Object.assign(data, opts.extraData);
  }

  // Clean undefined values so Prisma doesn't complain
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  await prisma.robot.update({
    where: { id: opts.robotId },
    data,
  });

  // Update bestWinStreak if currentWinStreak exceeds it (only for league wins)
  if (opts.battleType === 'league' && opts.isWinner) {
    await prisma.$executeRawUnsafe(
      `UPDATE robots SET best_win_streak = current_win_streak WHERE id = $1 AND current_win_streak > best_win_streak`,
      opts.robotId,
    );
  }
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
