// ─── KotH Battle Orchestration ──────────────────────────────────────

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { KothError, KothErrorCode } from '../../errors/kothErrors';

/** Yield the event loop so Express can serve requests between heavy DB work */
const throttle = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Delay between processing each KotH match (ms) - reduced from 2000ms */
const MATCH_THROTTLE_MS = 500;
/** Number of matches to process before a longer cooldown pause */
const BATCH_SIZE = 10;
/** Cooldown pause between batches to allow GC and free memory (ms) */
const BATCH_COOLDOWN_MS = 5000;
/** Number of matches before a super-batch pause for heavy GC (memory safety) */
const SUPER_BATCH_SIZE = 20;
/** Long pause between super-batches to ensure memory is reclaimed (ms) */
const SUPER_BATCH_COOLDOWN_MS = 30000;
import { simulateBattleMulti, RobotWithWeapons, BattleConfig } from '../battle/combatSimulator';
import {
  buildKothGameModeConfig,
  buildKothInitialState,
  buildKothTickHook,
  buildEnrichedPlacements,
  KothMatchConfig,
  KOTH_MATCH_DEFAULTS,
  KothScoreState,
  KothZoneState,
} from '../arena/kothEngine';

import {
  logBattleAuditEvent,
  checkAndAwardAchievements,
} from '../battle/battlePostCombat';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { calculateStreamingRevenue } from '../economy/streamingRevenueService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonuses } from '../tuning-pool';

/** Prepared participant data for batched DB operations */
interface PreparedParticipant {
  robot: RobotWithWeapons;
  placement: number;
  zoneScore: number;
  zoneTime: number;
  uncontestedScore: number;
  kills: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
  isWinner: boolean;
  rewards: { credits: number; prestige: number; fame: number; zoneDominanceBonus: boolean };
}

/** Summary of a KotH battle execution run */
export interface KothBattleExecutionSummary {
  totalMatches: number;
  successfulMatches: number;
  failedMatches: number;
  totalRobotsInvolved: number;
  matchResults: Array<{
    matchId: number;
    winnerId: number | null;
    placements: Array<{ robotId: number; placement: number; zoneScore: number }>;
  }>;
  errors: string[];
}

/**
 * Calculate KotH rewards based on placement, zone score, and uncontested time.
 *
 * Per Requirement 14:
 *  - Credits: 1st ₡50,000 / 2nd ₡35,000 / 3rd ₡20,000 / 4th+ ₡10,000
 *  - Fame: 1st = 8 / 2nd = 5 / 3rd = 3 (winner gets performance multiplier)
 *  - Prestige: 1st = 15 / 2nd = 8 / 3rd = 3 / 4th+ = 0
 *  - Zone dominance bonus: +25% to all rewards when winner got >75% of
 *    points from uncontested zone control (vs kill bonuses)
 */
export function calculateKothRewards(
  placement: number,
  zoneScore: number,
  uncontestedScore: number,
  winnerHPPercent?: number,
): { credits: number; prestige: number; fame: number; zoneDominanceBonus: boolean } {
  // Base credits by placement (Req 14.1)
  const creditsByPlacement: Record<number, number> = {
    1: 25000, 2: 17500, 3: 10000,
  };
  let credits = creditsByPlacement[placement] ?? 5000;

  // Base fame by placement (Req 14.3)
  const fameByPlacement: Record<number, number> = {
    1: 8, 2: 5, 3: 3,
  };
  let fame = fameByPlacement[placement] ?? 0;

  // Performance multiplier for winner's fame (Req 14.3)
  if (placement === 1 && winnerHPPercent !== undefined) {
    let fameMultiplier = 1.0;
    if (winnerHPPercent >= 100) fameMultiplier = 2.0;       // Perfect Victory
    else if (winnerHPPercent > 80) fameMultiplier = 1.5;    // Dominating
    else if (winnerHPPercent < 20) fameMultiplier = 1.25;   // Comeback
    fame = Math.round(fame * fameMultiplier);
  }

  // Prestige by placement (Req 14.4)
  const prestigeByPlacement: Record<number, number> = {
    1: 15, 2: 8, 3: 3,
  };
  let prestige = prestigeByPlacement[placement] ?? 0;

  // Zone dominance bonus: +25% when >75% of points from uncontested zone
  // control (as opposed to kill bonuses) (Req 14.2)
  const zoneDominanceBonus = zoneScore > 0 && (uncontestedScore / zoneScore) > 0.75;

  if (zoneDominanceBonus) {
    credits = Math.floor(credits * 1.25);
    fame = Math.floor(fame * 1.25);
    prestige = Math.floor(prestige * 1.25);
  }

  return { credits, prestige, fame, zoneDominanceBonus };
}

/**
 * Batch update cumulative KotH stats for all robots in a match.
 * Uses a single transaction with raw SQL for optimal performance.
 */
async function batchUpdateKothRobotStats(
  participants: PreparedParticipant[],
): Promise<void> {
  // Pre-fetch all robots in a single query to get current streak values
  const robotIds = participants.map(p => p.robot.id);
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    select: {
      id: true,
      kothBestPlacement: true,
      kothCurrentWinStreak: true,
      kothBestWinStreak: true,
    },
  });
  const robotMap = new Map(robots.map(r => [r.id, r]));

  // Build all updates and execute in a single transaction
  const updates = participants.map(p => {
    const robot = robotMap.get(p.robot.id);
    const currentBest = robot?.kothBestPlacement ?? null;
    const newBestPlacement = currentBest === null || currentBest === 0
      ? p.placement
      : Math.min(currentBest, p.placement);

    const currentStreak = robot?.kothCurrentWinStreak ?? 0;
    const currentBestStreak = robot?.kothBestWinStreak ?? 0;
    const newWinStreak = p.isWinner ? currentStreak + 1 : 0;
    const newBestStreak = Math.max(currentBestStreak, newWinStreak);

    return prisma.robot.update({
      where: { id: p.robot.id },
      data: {
        // Persist battle damage to database (HP only - shields recharge between battles)
        currentHP: Math.max(0, p.finalHP),
        kothMatches: { increment: 1 },
        kothWins: p.isWinner ? { increment: 1 } : undefined,
        kothTotalZoneScore: { increment: p.zoneScore },
        kothTotalZoneTime: { increment: p.zoneTime },
        kothKills: { increment: p.kills },
        kothBestPlacement: newBestPlacement,
        kothCurrentWinStreak: newWinStreak,
        kothBestWinStreak: newBestStreak,
      },
    });
  });

  await prisma.$transaction(updates);
}

/**
 * Process a single KotH match using the unified N-robot simulator.
 * Builds KotH game mode config + state + tick hook, calls simulateBattleMulti(),
 * then maps the result to DB records.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Batched BattleParticipant creation via createMany
 * - Batched user/robot currency updates via transaction
 * - Batched KotH stats updates via transaction
 * - Streaming revenue calculated in parallel
 * - Audit events batched via transaction
 * 
 * Requirement 13: KotH Battle Playback Integration.
 */
async function processKothBattle(
  match: {
    id: number;
    rotatingZone: boolean;
    scoreThreshold: number | null;
    timeLimit: number | null;
    zoneRadius: number | null;
    participants: Array<{ robotId: number }>;
  }
): Promise<{ winnerId: number | null; placements: Array<{ robotId: number; placement: number; zoneScore: number }> }> {
  const robotIds = match.participants.map(p => p.robotId);

  // 1. Load all participant robots with weapons
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (robots.length < 5) {
    throw new KothError(
      KothErrorCode.INSUFFICIENT_KOTH_PARTICIPANTS,
      `KotH match ${match.id}: expected at least 5 robots, found ${robots.length}`,
      400,
      { matchId: match.id, expected: 5, found: robots.length }
    );
  }

  // 1b. Ensure in-memory HP/shield is at max for simulation
  // Robots enter KotH battles at full HP (simulation uses maxHP, damage persisted after battle)
  // Fetch tuning bonuses and prepare all robots for combat (applies tuning, recalculates maxHP/maxShield, sets full HP)
  const tuningBonusesMap = await Promise.all(
    robots.map(robot => getTuningBonuses(robot.id))
  );
  for (let i = 0; i < robots.length; i++) {
    prepareRobotForCombat(robots[i], tuningBonusesMap[i]);
  }

  // 2. Resolve config values
  const scoreThreshold = match.scoreThreshold ?? (match.rotatingZone
    ? KOTH_MATCH_DEFAULTS.rotatingZoneScoreThreshold
    : KOTH_MATCH_DEFAULTS.scoreThreshold);
  const timeLimit = match.timeLimit ?? (match.rotatingZone
    ? KOTH_MATCH_DEFAULTS.rotatingZoneTimeLimit
    : KOTH_MATCH_DEFAULTS.timeLimit);
  const zoneRadius = match.zoneRadius ?? KOTH_MATCH_DEFAULTS.zoneRadius;
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius;

  // 3. Build KotH game mode config, state, and tick hook
  const kothConfig: KothMatchConfig = {
    scoreThreshold,
    timeLimit,
    zoneRadius,
    rotatingZone: match.rotatingZone,
    participantCount: robots.length,
    matchId: match.id,
  };

  const gameModeConfig = buildKothGameModeConfig(kothConfig);
  const gameModeState = buildKothInitialState(kothConfig, robotIds);

  const scoreState = gameModeState.customData!.scoreState as KothScoreState;
  const zoneState = gameModeState.customData!.zoneState as KothZoneState;

  // Wire the tick hook — KotH-specific per-tick logic (zone scoring, penalties, rotation)
  const tickHook = buildKothTickHook(kothConfig, scoreState, zoneState, gameModeState);
  (gameModeState.customData as Record<string, unknown>).tickHook = tickHook;

  // 4. Run unified simulation
  const battleConfig: BattleConfig = {
    allowDraws: false,
    maxDuration: timeLimit,
    gameModeConfig,
    gameModeState,
    arenaRadius,
  };

  const simResult = simulateBattleMulti(robots as RobotWithWeapons[], battleConfig);

  // 5. Build enriched placements from KotH score state + final combat states
  const enrichedPlacements = buildEnrichedPlacements(scoreState, simResult.finalStates ?? []);

  const winnerId = simResult.winnerId ?? (enrichedPlacements.length > 0 ? enrichedPlacements[0].robotId : null);
  const winReason = simResult.kothMetadata?.winReason ?? 'time_limit';

  // 6. Determine 1st and 2nd place for Battle record backward compat
  const first = enrichedPlacements[0];
  const second = enrichedPlacements[1];
  const winnerRobot = robots.find(r => r.id === first.robotId)!;
  const secondRobot = robots.find(r => r.id === second.robotId)!;

  // Pass position records directly (keyed by robot name) to buildKothBattleLog
  const startPosRecord = simResult.startingPositions ?? {};
  const endPosRecord = simResult.endingPositions ?? {};

  // 7. Create Battle record with full spatial data
  const battle = await prisma.battle.create({
    data: {
      robot1Id: winnerRobot.id,
      robot2Id: secondRobot.id,
      winnerId: winnerRobot.id,
      battleType: 'koth',
      leagueType: 'koth',
      battleLog: JSON.parse(JSON.stringify(CombatMessageGenerator.buildKothBattleLog({
        events: simResult.events,
        participantCount: robots.length,
        arenaRadius,
        startingPositions: startPosRecord,
        endingPositions: endPosRecord,
        scoreThreshold,
        zoneRadius,
        placements: enrichedPlacements.map(p => ({
          robotId: p.robotId,
          robotName: p.robotName,
          placement: p.placement,
          zoneScore: p.zoneScore,
          zoneTime: p.zoneTime,
          kills: p.kills,
          destroyed: p.destroyed,
        })),
      }))),
      durationSeconds: simResult.durationSeconds,
      winnerReward: 0,
      loserReward: 0,
      robot1ELOBefore: winnerRobot.elo,
      robot2ELOBefore: secondRobot.elo,
      robot1ELOAfter: winnerRobot.elo,
      robot2ELOAfter: secondRobot.elo,
      eloChange: 0,
    },
  });

  // 8. Prepare all participant data for batched operations
  const preparedParticipants: PreparedParticipant[] = enrichedPlacements.map(p => {
    const robot = robots.find(r => r.id === p.robotId)!;
    const isWinner = robot.id === winnerId;
    const hpPercent = robot.maxHP > 0 ? (p.finalHP / robot.maxHP) * 100 : 0;
    const rewards = calculateKothRewards(
      p.placement, p.zoneScore, p.uncontestedScore,
      isWinner ? hpPercent : undefined,
    );
    return {
      robot: robot as RobotWithWeapons,
      placement: p.placement,
      zoneScore: p.zoneScore,
      zoneTime: p.zoneTime,
      uncontestedScore: p.uncontestedScore,
      kills: p.kills,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      destroyed: p.destroyed,
      isWinner,
      rewards,
    };
  });

  // 9. BATCHED: Create all BattleParticipant records in one operation
  await prisma.battleParticipant.createMany({
    data: preparedParticipants.map(p => ({
      battleId: battle.id,
      robotId: p.robot.id,
      team: 1,
      placement: p.placement,
      role: null,
      credits: p.rewards.credits,
      streamingRevenue: 0, // Updated below
      eloBefore: p.robot.elo,
      eloAfter: p.robot.elo,
      prestigeAwarded: p.rewards.prestige,
      fameAwarded: p.rewards.fame,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      yielded: false,
      destroyed: p.destroyed,
    })),
  });

  // 10. BATCHED: Calculate streaming revenue in parallel, then batch update
  const _cycleNumber = await getCurrentCycleNumber();
  const streamingCalcs = await Promise.all(
    preparedParticipants.map(p => calculateStreamingRevenue(p.robot.id, p.robot.userId, false))
  );

  // 11. BATCHED: All currency/prestige/fame updates in a single transaction
  const currencyUpdates: Prisma.PrismaPromise<unknown>[] = [];
  
  // Group credits by userId to combine multiple robots from same user
  const creditsByUser = new Map<number, number>();
  const prestigeByUser = new Map<number, number>();
  const fameByRobot = new Map<number, number>();
  const streamingByUser = new Map<number, number>();

  preparedParticipants.forEach((p, i) => {
    if (p.rewards.credits > 0) {
      creditsByUser.set(p.robot.userId, (creditsByUser.get(p.robot.userId) ?? 0) + p.rewards.credits);
    }
    if (p.rewards.prestige > 0) {
      prestigeByUser.set(p.robot.userId, (prestigeByUser.get(p.robot.userId) ?? 0) + p.rewards.prestige);
    }
    if (p.rewards.fame > 0) {
      fameByRobot.set(p.robot.id, (fameByRobot.get(p.robot.id) ?? 0) + p.rewards.fame);
    }
    const streamingCalc = streamingCalcs[i];
    if (streamingCalc) {
      streamingByUser.set(p.robot.userId, (streamingByUser.get(p.robot.userId) ?? 0) + streamingCalc.totalRevenue);
    }
  });

  // Build transaction operations
  for (const [userId, credits] of creditsByUser) {
    const streaming = streamingByUser.get(userId) ?? 0;
    const prestige = prestigeByUser.get(userId) ?? 0;
    currencyUpdates.push(
      prisma.user.update({
        where: { id: userId },
        data: {
          currency: { increment: credits + streaming },
          prestige: prestige > 0 ? { increment: prestige } : undefined,
        },
      })
    );
  }

  for (const [robotId, fame] of fameByRobot) {
    currencyUpdates.push(
      prisma.robot.update({
        where: { id: robotId },
        data: { fame: { increment: fame } },
      })
    );
  }

  // Execute all currency updates in a single transaction
  if (currencyUpdates.length > 0) {
    await prisma.$transaction(currencyUpdates);
  }

  // 12. BATCHED: Update streaming revenue on BattleParticipant records
  const streamingUpdates = preparedParticipants
    .map((p, i) => {
      const calc = streamingCalcs[i];
      if (!calc) return null;
      return prisma.battleParticipant.update({
        where: { battleId_robotId: { battleId: battle.id, robotId: p.robot.id } },
        data: { streamingRevenue: calc.totalRevenue },
      });
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (streamingUpdates.length > 0) {
    await prisma.$transaction(streamingUpdates);
  }

  // 13. BATCHED: Update KotH robot stats
  await batchUpdateKothRobotStats(preparedParticipants);

  // 13b. Check and award achievements for all participants
  for (const p of preparedParticipants) {
    await checkAndAwardAchievements(p.robot.userId, p.robot.id, {
      won: p.isWinner,
      destroyed: p.destroyed,
      finalHpPercent: p.robot.maxHP > 0 ? (p.finalHP / p.robot.maxHP) * 100 : 0,
      eloDiff: 0,
      opponentElo: 0,
      yielded: false,
      opponentYielded: false,
      previousBattleLost: false,
      damageDealt: p.damageDealt,
      opponentDamageDealt: 0,
      loadoutType: (p.robot as unknown as { loadoutType?: string }).loadoutType || 'single',
      stance: (p.robot as unknown as { stance?: string }).stance || 'balanced',
      yieldThreshold: 0,
      hasTuning: false,
      hasMainWeapon: p.robot.mainWeaponId !== null,
      battleType: 'koth',
      battleDurationSeconds: simResult.durationSeconds,
    });
  }

  // 14. BATCHED: Log audit events (fire-and-forget for performance)
  // Audit logging is non-critical and can be done asynchronously
  setImmediate(async () => {
    try {
      for (let i = 0; i < preparedParticipants.length; i++) {
        const p = preparedParticipants[i];
        const streamingCalc = streamingCalcs[i];
        await logBattleAuditEvent(
          {
            robotId: p.robot.id,
            userId: p.robot.userId,
            isWinner: p.isWinner,
            isDraw: false,
            damageDealt: p.damageDealt,
            finalHP: p.finalHP,
            yielded: false,
            destroyed: p.destroyed,
            credits: p.rewards.credits,
            prestige: p.rewards.prestige,
            fame: p.rewards.fame,
            eloBefore: p.robot.elo,
            eloAfter: p.robot.elo,
          },
          { id: battle.id, battleType: 'koth', leagueType: 'koth', durationSeconds: simResult.durationSeconds, eloChange: 0 },
          null,
          streamingCalc?.totalRevenue || 0,
          false,
          {
            kothPlacement: p.placement,
            kothZoneScore: p.zoneScore,
            kothZoneTime: p.zoneTime,
            kothKills: p.kills,
            kothZoneDominanceBonus: p.rewards.zoneDominanceBonus,
          },
        );
      }
    } catch (err) {
      logger.error('[KotH] Audit logging failed (non-critical):', err);
    }
  });

  // 15. Mark match completed
  await prisma.scheduledKothMatch.update({
    where: { id: match.id },
    data: { status: 'completed', battleId: battle.id },
  });

  logger.info(`[KotH] Match #${match.id} complete: Winner=${winnerRobot.name}, ${robots.length} participants, Battle #${battle.id}, Duration=${simResult.durationSeconds}s, Reason=${winReason}`);

  return {
    winnerId,
    placements: enrichedPlacements.map(p => ({ robotId: p.robotId, placement: p.placement, zoneScore: p.zoneScore })),
  };
}

/**
 * Execute all scheduled KotH battles.
 * Queries ScheduledKothMatch with status 'scheduled', processes each,
 * and returns a summary of results.
 * 
 * MEMORY OPTIMIZATION STRATEGY:
 * - Process matches one at a time (no batch loading)
 * - Short pause (500ms) between each match for event loop
 * - Medium pause (5s) every 10 matches for GC opportunity  
 * - Long pause (30s) every 20 matches to force memory reclamation
 * 
 * For 200 matches on 2GB RAM VPS:
 * - 10 super-batches of 20 matches each
 * - ~5 minutes of GC pauses total
 * - Peak memory should stay under 500MB
 */
export async function executeScheduledKothBattles(_scheduledFor?: Date): Promise<KothBattleExecutionSummary> {
  logger.info('[KotH Orchestrator] Executing scheduled KotH battles');

  // Count total scheduled matches without loading them all into memory
  const totalCount = await prisma.scheduledKothMatch.count({ where: { status: 'scheduled' } });
  logger.info(`[KotH Orchestrator] Found ${totalCount} KotH matches to execute`);

  const summary: KothBattleExecutionSummary = {
    totalMatches: totalCount,
    successfulMatches: 0,
    failedMatches: 0,
    totalRobotsInvolved: 0,
    matchResults: [],
    errors: [],
  };

  let processed = 0;

  // Process one match at a time: fetch → execute → release memory → repeat
  // This prevents accumulating all match data in memory simultaneously
  while (processed < totalCount) {
    // Fetch the next single scheduled match
    let match = await prisma.scheduledKothMatch.findFirst({
      where: { status: 'scheduled' },
      include: { participants: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!match) break; // No more scheduled matches

    // SUPER-BATCH: Every 20 matches, take a long pause for memory reclamation
    // This is critical for 200+ match runs on limited RAM
    if (processed > 0 && processed % SUPER_BATCH_SIZE === 0) {
      const memBefore = process.memoryUsage().heapUsed;
      logger.info(`[KotH Orchestrator] Super-batch cooldown after ${processed} matches (mem: ${Math.round(memBefore / 1024 / 1024)}MB) - waiting ${SUPER_BATCH_COOLDOWN_MS / 1000}s for GC`);
      
      // Clear any references we can
      match = null as unknown as typeof match;
      
      // Force GC if available (run with --expose-gc flag)
      if (global.gc) {
        global.gc();
      }
      
      // Long pause to let GC complete and memory be returned to OS
      await throttle(SUPER_BATCH_COOLDOWN_MS);
      
      // Try GC again after pause
      if (global.gc) {
        global.gc();
      }
      
      const memAfter = process.memoryUsage().heapUsed;
      logger.info(`[KotH Orchestrator] Super-batch resumed (mem: ${Math.round(memAfter / 1024 / 1024)}MB, freed: ${Math.round((memBefore - memAfter) / 1024 / 1024)}MB)`);
      
      // Re-fetch the match since we nullified it
      match = await prisma.scheduledKothMatch.findFirst({
        where: { status: 'scheduled' },
        include: { participants: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!match) break;
    }
    // REGULAR BATCH: Every 10 matches, short pause for GC opportunity
    else if (processed > 0 && processed % BATCH_SIZE === 0) {
      logger.info(`[KotH Orchestrator] Batch cooldown after ${processed} matches (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
      await throttle(BATCH_COOLDOWN_MS);
      if (global.gc) {
        global.gc();
      }
    } 
    // MATCH THROTTLE: Brief pause between each match
    else if (processed > 0) {
      await throttle(MATCH_THROTTLE_MS);
    }

    const matchId = match.id;
    const participantCount = match.participants.length;

    try {
      const result = await processKothBattle(match);
      summary.successfulMatches++;
      summary.totalRobotsInvolved += participantCount;
      // Only store lightweight placement data, not the full result
      summary.matchResults.push({ matchId, ...result });
    } catch (error) {
      summary.failedMatches++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`KotH Match ${matchId}: ${errorMsg}`);
      logger.error(`[KotH Orchestrator] Failed to process match ${matchId}:`, error);

      // Mark as error so the while loop doesn't re-fetch it in this run
      await prisma.scheduledKothMatch.update({
        where: { id: matchId },
        data: { status: 'error' },
      }).catch(() => {});
    }

    // Clear match reference to help GC
    match = null as unknown as typeof match;
    processed++;
  }

  // Reset any matches marked 'error' during this run back to 'scheduled' for retry next cycle
  if (summary.failedMatches > 0) {
    await prisma.scheduledKothMatch.updateMany({
      where: { status: 'error' },
      data: { status: 'scheduled' },
    });
    logger.info(`[KotH Orchestrator] Reset ${summary.failedMatches} failed matches back to 'scheduled' for retry`);
  }

  logger.info(`[KotH Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
  return summary;
}
