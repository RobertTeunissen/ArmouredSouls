// ─── Grand Melee Battle Orchestration ───────────────────────────────

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import { simulateBattleMulti, RobotWithWeapons, BattleConfig, SpatialCombatResult, SpatialRobotCombatState, SpatialCombatEvent } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import {
  logBattleAuditEvent,
  checkAndAwardAchievements,
  updateRobotCombatStats,
} from '../battle/battlePostCombat';
import standingsService from '../standings/standingsService';
import { calculateStreamingRevenueBatch } from '../economy/streamingRevenueService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { calculateGrandMeleeRewards } from './grandMeleeRewards';
import schedulingService from '../scheduling/schedulingService';

/** Yield the event loop so Express can serve requests between heavy DB work */
const throttle = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Delay between processing each Grand Melee match (ms) - 0 locally, 500 on server */
const MATCH_THROTTLE_MS = process.env.NODE_ENV === 'production' ? 500 : 0;
/** Number of matches to process before a longer cooldown pause */
const BATCH_SIZE = 10;
/** Cooldown pause between batches to allow GC and free memory (ms) */
const BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 5000 : 0;
/** Number of matches before a super-batch pause for heavy GC (memory safety) */
const SUPER_BATCH_SIZE = 20;
/** Long pause between super-batches to ensure memory is reclaimed (ms) */
const SUPER_BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 30000 : 0;

/** Minimum robots required to run a Grand Melee match */
const MIN_PARTICIPANTS = 8;

// ─── Interfaces ─────────────────────────────────────────────────────

/** Prepared participant data for batched DB operations */
interface PreparedParticipant {
  robot: RobotWithWeapons;
  placement: number;
  kills: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
  isWinner: boolean;
  rewards: { credits: number; prestige: number; fame: number; lpDelta: number };
}

/** Summary of a Grand Melee battle execution run */
export interface GrandMeleeBattleExecutionSummary {
  totalMatches: number;
  successfulMatches: number;
  failedMatches: number;
  totalRobotsInvolved: number;
  matchResults: Array<{
    matchId: number;
    winnerId: number | null;
    placements: Array<{ robotId: number; placement: number; kills: number }>;
  }>;
  errors: string[];
}

/** Placement result from computePlacements */
interface PlacementEntry {
  robotId: number;
  robotName: string;
  placement: number;
  kills: number;
  damageDealt: number;
  finalHP: number;
  destroyed: boolean;
}

// ─── Placement Computation ──────────────────────────────────────────

/**
 * Derive placement order from simulation result.
 *
 * Logic:
 * 1. Extract elimination timestamps from events (type 'robot_eliminated' or 'destroyed')
 * 2. Split into survivors (isAlive=true) and eliminated (isAlive=false)
 * 3. Sort survivors by HP% descending; tiebreak by totalDamageDealt descending
 * 4. Sort eliminated by elimination time descending (later = higher rank);
 *    same-tick tiebreak by totalDamageDealt descending
 * 5. Concat: survivors first, then eliminated
 * 6. Assign placements 1..N — no gaps, no duplicates
 * 7. Count kills per robot from elimination events
 */
function computePlacements(
  result: SpatialCombatResult,
  states: SpatialRobotCombatState[],
  events: SpatialCombatEvent[],
): PlacementEntry[] {
  // Build elimination time map: robotName → timestamp of elimination
  const eliminationTimeMap = new Map<string, number>();
  for (const event of events) {
    if (
      (event.type === 'destroyed' || event.type === 'robot_eliminated') &&
      event.defender
    ) {
      // Use earliest elimination event for each robot
      if (!eliminationTimeMap.has(event.defender)) {
        eliminationTimeMap.set(event.defender, event.timestamp);
      }
    }
  }

  // Count kills per robot from elimination events (attacker field)
  const killCountMap = new Map<string, number>();
  for (const event of events) {
    if (
      (event.type === 'destroyed' || event.type === 'robot_eliminated') &&
      event.attacker
    ) {
      killCountMap.set(event.attacker, (killCountMap.get(event.attacker) ?? 0) + 1);
    }
  }

  // Split states into survivors and eliminated
  const survivors: SpatialRobotCombatState[] = [];
  const eliminated: SpatialRobotCombatState[] = [];

  for (const state of states) {
    if (state.isAlive) {
      survivors.push(state);
    } else {
      eliminated.push(state);
    }
  }

  // Sort survivors: HP% descending, tiebreak by totalDamageDealt descending
  survivors.sort((a, b) => {
    const hpPercentA = a.maxHP > 0 ? a.currentHP / a.maxHP : 0;
    const hpPercentB = b.maxHP > 0 ? b.currentHP / b.maxHP : 0;
    if (hpPercentB !== hpPercentA) return hpPercentB - hpPercentA;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Sort eliminated: later elimination = higher rank (descending timestamp)
  // Same-tick tiebreak: higher totalDamageDealt = higher rank
  eliminated.sort((a, b) => {
    const timeA = eliminationTimeMap.get(a.robot.name) ?? 0;
    const timeB = eliminationTimeMap.get(b.robot.name) ?? 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Concat: survivors first, then eliminated
  const ordered = [...survivors, ...eliminated];

  // Assign placements 1..N
  return ordered.map((state, index) => ({
    robotId: state.robot.id,
    robotName: state.robot.name,
    placement: index + 1,
    kills: killCountMap.get(state.robot.name) ?? 0,
    damageDealt: state.totalDamageDealt,
    finalHP: Math.max(0, state.currentHP),
    destroyed: !state.isAlive,
  }));
}

// ─── Batch Robot Stats Update ───────────────────────────────────────

/**
 * Batch update Grand Melee robot stats: persist HP/damage and delegate standings.
 */
async function batchUpdateGrandMeleeRobotStats(
  participants: PreparedParticipant[],
  durationSeconds: number,
): Promise<void> {
  // 1. Update robot combat stats via unified function (skipBattleCounters for Grand Melee)
  for (const p of participants) {
    await updateRobotCombatStats({
      robotId: p.robot.id,
      finalHP: p.finalHP,
      newELO: p.robot.elo, // Grand Melee doesn't use ELO
      isWinner: p.isWinner,
      isDraw: false, // Grand Melee never draws
      damageDealt: p.damageDealt,
      damageTakenByOpponent: p.robot.maxHP - p.finalHP,
      opponentDestroyed: p.kills > 0,
      fameIncrement: 0, // Fame handled separately in reward distribution
      battleType: 'grand_melee',
      stance: p.robot.stance,
      loadoutType: p.robot.loadoutType,
      skipBattleCounters: true,
    });

    // Increment Grand Melee win/top3 counters
    if (p.placement === 1) {
      await prisma.robot.update({
        where: { id: p.robot.id },
        data: { grandMeleeWins: { increment: 1 } },
      });
    }
    if (p.placement <= 3) {
      await prisma.robot.update({
        where: { id: p.robot.id },
        data: { grandMeleeTop3: { increment: 1 } },
      });
    }
  }

  // 2. Award Grand Melee points and update standings via unified service
  for (const p of participants) {
    await standingsService.awardGrandMeleePoints({
      robotId: p.robot.id,
      placement: p.placement,
      totalParticipants: participants.length,
      kills: p.kills,
      damageDealt: p.damageDealt,
      survivalTime: durationSeconds,
    });
  }
}

// ─── Single Match Processing ────────────────────────────────────────

/**
 * Process a single Grand Melee match using the unified N-robot simulator.
 * Pure elimination with allowDraws: false — no game mode config, no zone mechanics.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Batched BattleParticipant creation via createMany
 * - Batched user/robot currency updates via transaction
 * - Streaming revenue calculated in parallel
 * - Audit events fire-and-forget via setImmediate
 */
async function processGrandMeleeBattle(
  match: {
    id: number;
    participants: Array<{ participantId: number }>;
  },
): Promise<{ winnerId: number | null; placements: Array<{ robotId: number; placement: number; kills: number }> }> {
  const robotIds = match.participants.map(p => p.participantId);

  // 1. Load all participant robots with weapons + refinements
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });

  // 2. Check minimum participant count
  if (robots.length < MIN_PARTICIPANTS) {
    throw new Error(
      `Grand Melee match ${match.id}: expected at least ${MIN_PARTICIPANTS} robots, found ${robots.length}`,
    );
  }

  // 3. Batch-fetch tuning bonuses and prepare robots for combat
  const tuningBonusesMap = await getTuningBonusesBatch(robotIds);
  for (const robot of robots) {
    prepareRobotForCombat(robot, tuningBonusesMap.get(robot.id) ?? {});
  }

  // 4. Compute arena radius from formula: 16 + (N - 2) * 3
  const arenaRadius = 16 + (robots.length - 2) * 3;

  // 5. Run unified simulation (pure elimination, no game mode config)
  const battleConfig: BattleConfig = {
    allowDraws: false,
    arenaRadius,
  };

  const simResult = simulateBattleMulti(robots as RobotWithWeapons[], battleConfig);

  // 6. Compute placements from elimination order + HP tiebreaker
  const finalStates = simResult.finalStates ?? [];
  const placements = computePlacements(simResult, finalStates, simResult.events);

  const winnerId = placements.length > 0 ? placements[0].robotId : null;
  const winnerRobot = robots.find(r => r.id === winnerId);

  // 7. Look up each robot's Grand Melee tier from standings for reward calculation
  const robotStandings = await prisma.standing.findMany({
    where: {
      mode: 'grand_melee',
      entityType: 'robot',
      entityId: { in: robotIds },
    },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(robotStandings.map(s => [s.entityId, s.tier]));

  // 8. Prepare all participant data for batched operations
  const preparedParticipants: PreparedParticipant[] = placements.map(p => {
    const robot = robots.find(r => r.id === p.robotId)!;
    const isWinner = robot.id === winnerId;
    const hpPercent = robot.maxHP > 0 ? (p.finalHP / robot.maxHP) * 100 : 0;
    const robotTier = tierByRobot.get(robot.id) ?? 'bronze';
    const rewards = calculateGrandMeleeRewards(
      p.placement,
      robotTier,
      robots.length,
      isWinner ? hpPercent : undefined,
    );
    return {
      robot: robot as RobotWithWeapons,
      placement: p.placement,
      kills: p.kills,
      damageDealt: p.damageDealt,
      finalHP: p.finalHP,
      destroyed: p.destroyed,
      isWinner,
      rewards,
    };
  });

  // 9. Create Battle record (with battleLog — same format as KotH for playback support)
  const startPosRecord = simResult.startingPositions ?? {};
  const endPosRecord = simResult.endingPositions ?? {};

  const battle = await prisma.battle.create({
    data: {
      winnerId: winnerId,
      battleType: 'grand_melee',
      leagueType: tierByRobot.get(winnerId ?? 0) ?? 'bronze',
      battleLog: CombatMessageGenerator.buildKothBattleLog({
        events: simResult.events,
        participantCount: robots.length,
        arenaRadius,
        startingPositions: startPosRecord,
        endingPositions: endPosRecord,
        scoreThreshold: 0, // Grand Melee has no score threshold
        zoneRadius: 0, // Grand Melee has no zone
        placements: placements.map(p => ({
          robotId: p.robotId,
          robotName: p.robotName,
          placement: p.placement,
          zoneScore: 0,
          zoneTime: 0,
          kills: p.kills,
          destroyed: p.destroyed,
        })),
      }) as unknown as Prisma.InputJsonValue,
      durationSeconds: simResult.durationSeconds,
      winnerReward: 0,
      loserReward: 0,
    },
  });

  // 10. Create BattleParticipant records for all robots
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

  // 11. Write pre-computed battle summary (Spec #39)
  const robotMaxHP: Record<string, number> = {};
  const robotNameToId: Record<string, number> = {};
  const robotNameToTeam: Record<string, number> = {};
  for (const robot of robots) {
    robotMaxHP[robot.name] = robot.maxHP;
    robotNameToId[robot.name] = robot.id;
    robotNameToTeam[robot.name] = 1; // Grand Melee has no teams — all on side 1
  }

  // Reuse kothPlacements field shape for Grand Melee placement data
  const kothPlacementsForSummary = placements.map(p => ({
    robotId: p.robotId,
    robotName: p.robotName,
    placement: p.placement,
    zoneScore: 0,
    zoneTime: 0,
    kills: p.kills,
    destroyed: p.destroyed,
  }));

  const summaryData = computeBattleSummary({
    events: (simResult.events || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: simResult.durationSeconds,
    battleType: 'grand_melee',
    robotMaxHP,
    robotNameToId,
    robotNameToTeam,
    kothPlacements: kothPlacementsForSummary,
    kothData: { participantCount: robots.length, scoreThreshold: 0 },
    startingPositions: startPosRecord as Record<string, { x: number; y: number }>,
    endingPositions: endPosRecord as Record<string, { x: number; y: number }>,
    arenaRadius,
  });

  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[grand-melee-orchestrator] Failed to write battle summary', {
        battleId: battle.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 12. Calculate streaming revenue with single batch query
  const _cycleNumber = await getCurrentCycleNumber();
  const streamingCalcMap = await calculateStreamingRevenueBatch(
    preparedParticipants.map(p => ({ robotId: p.robot.id, userId: p.robot.userId })),
  );

  // 13. Batched currency/prestige/fame updates in a single transaction
  const currencyUpdates: Prisma.PrismaPromise<unknown>[] = [];

  // Group credits by userId to combine multiple robots from same user
  const creditsByUser = new Map<number, number>();
  const prestigeByUser = new Map<number, number>();
  const fameByRobot = new Map<number, number>();
  const streamingByUser = new Map<number, number>();

  preparedParticipants.forEach((p) => {
    if (p.rewards.credits > 0) {
      creditsByUser.set(p.robot.userId, (creditsByUser.get(p.robot.userId) ?? 0) + p.rewards.credits);
    }
    if (p.rewards.prestige > 0) {
      prestigeByUser.set(p.robot.userId, (prestigeByUser.get(p.robot.userId) ?? 0) + p.rewards.prestige);
    }
    if (p.rewards.fame > 0) {
      fameByRobot.set(p.robot.id, (fameByRobot.get(p.robot.id) ?? 0) + p.rewards.fame);
    }
    const streamingCalc = streamingCalcMap.get(p.robot.id);
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
      }),
    );
  }

  for (const [robotId, fame] of fameByRobot) {
    currencyUpdates.push(
      prisma.robot.update({
        where: { id: robotId },
        data: { fame: { increment: fame } },
      }),
    );
  }

  // Execute all currency updates in a single transaction
  if (currencyUpdates.length > 0) {
    await prisma.$transaction(currencyUpdates);
  }

  // 14. Update streaming revenue on BattleParticipant records
  const streamingUpdates = preparedParticipants
    .map((p) => {
      const calc = streamingCalcMap.get(p.robot.id);
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

  // 15. Update Grand Melee robot stats + standings
  await batchUpdateGrandMeleeRobotStats(preparedParticipants, simResult.durationSeconds);

  // 16. Check and award achievements (deferred — non-critical path)
  setImmediate(async () => {
    try {
      const prevBattleResults = await prisma.battleParticipant.findMany({
        where: {
          robotId: { in: preparedParticipants.map(p => p.robot.id) },
          battleId: { not: battle.id },
        },
        orderBy: { battle: { createdAt: 'desc' } },
        distinct: ['robotId'],
        select: { robotId: true, battle: { select: { winnerId: true } } },
      });
      const prevLostMap = new Map<number, boolean>(
        prevBattleResults.map(r => [r.robotId, r.battle.winnerId !== null && r.battle.winnerId !== r.robotId]),
      );

      await Promise.all(preparedParticipants.map(p => {
        const prevLost = prevLostMap.get(p.robot.id) ?? false;
        return checkAndAwardAchievements(p.robot.userId, p.robot.id, {
          won: p.isWinner,
          destroyed: p.destroyed,
          finalHpPercent: p.robot.maxHP > 0 ? (p.finalHP / p.robot.maxHP) * 100 : 0,
          eloDiff: 0,
          opponentElo: 0,
          yielded: false,
          opponentYielded: false,
          previousBattleLost: prevLost,
          damageDealt: p.damageDealt,
          opponentDamageDealt: 0,
          loadoutType: (p.robot as unknown as { loadoutType?: string }).loadoutType || 'single',
          stance: (p.robot as unknown as { stance?: string }).stance || 'balanced',
          yieldThreshold: 0,
          hasTuning: false,
          hasMainWeapon: p.robot.mainWeaponId !== null,
          battleType: 'grand_melee',
          battleDurationSeconds: simResult.durationSeconds,
        });
      }));
    } catch (err) {
      logger.error('[Grand Melee] Achievement check failed (non-critical):', err);
    }
  });

  // 17. Log audit events (fire-and-forget for performance)
  setImmediate(async () => {
    try {
      for (const p of preparedParticipants) {
        const streamingCalc = streamingCalcMap.get(p.robot.id);
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
          { id: battle.id, battleType: 'grand_melee', leagueType: 'grand_melee', durationSeconds: simResult.durationSeconds, eloChange: 0 },
          null,
          streamingCalc?.totalRevenue || 0,
          false,
          {
            kothPlacement: p.placement,
            kothZoneScore: 0,
            kothZoneTime: 0,
            kothKills: p.kills,
            kothZoneDominanceBonus: false,
          },
        );
      }
    } catch (err) {
      logger.error('[Grand Melee] Audit logging failed (non-critical):', err);
    }
  });

  // 18. Mark match completed
  await schedulingService.completeMatch(match.id, battle.id);

  logger.info(
    `[Grand Melee] Match #${match.id} complete: Winner=${winnerRobot?.name ?? 'none'}, ${robots.length} participants, Battle #${battle.id}, Duration=${simResult.durationSeconds}s`,
  );

  return {
    winnerId,
    placements: placements.map(p => ({ robotId: p.robotId, placement: p.placement, kills: p.kills })),
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Execute all scheduled Grand Melee battles.
 * Queries ScheduledMatch with matchType 'grand_melee' and status 'scheduled',
 * processes each sequentially, and returns a summary of results.
 *
 * MEMORY OPTIMIZATION STRATEGY:
 * - Process matches one at a time (no batch loading)
 * - Short pause (500ms) between each match for event loop
 * - Medium pause (5s) every 10 matches for GC opportunity
 * - Long pause (30s) every 20 matches to force memory reclamation
 *
 * For 20-robot matches on 2GB RAM VPS:
 * - Spatial partitioning keeps per-match memory reasonable
 * - Batch/super-batch pauses allow GC between matches
 */
export async function executeScheduledGrandMeleeBattles(): Promise<GrandMeleeBattleExecutionSummary> {
  logger.info('[Grand Melee Orchestrator] Executing scheduled Grand Melee battles');

  // Count total scheduled Grand Melee matches
  const totalCount = await prisma.scheduledMatch.count({
    where: { matchType: 'grand_melee', status: 'scheduled' },
  });
  logger.info(`[Grand Melee Orchestrator] Found ${totalCount} Grand Melee matches to execute`);

  const summary: GrandMeleeBattleExecutionSummary = {
    totalMatches: totalCount,
    successfulMatches: 0,
    failedMatches: 0,
    totalRobotsInvolved: 0,
    matchResults: [],
    errors: [],
  };

  let processed = 0;

  // Process one match at a time: fetch → execute → release memory → repeat
  while (processed < totalCount) {
    // Fetch the next single scheduled match
    let unifiedMatch = await prisma.scheduledMatch.findFirst({
      where: { matchType: 'grand_melee', status: 'scheduled' },
      include: { participants: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!unifiedMatch) break;

    // SUPER-BATCH: Every 20 matches, take a long pause for memory reclamation
    if (processed > 0 && processed % SUPER_BATCH_SIZE === 0) {
      const memBefore = process.memoryUsage().heapUsed;
      logger.info(
        `[Grand Melee Orchestrator] Super-batch cooldown after ${processed} matches (mem: ${Math.round(memBefore / 1024 / 1024)}MB) - waiting ${SUPER_BATCH_COOLDOWN_MS / 1000}s for GC`,
      );

      if (global.gc) global.gc();
      await throttle(SUPER_BATCH_COOLDOWN_MS);
      if (global.gc) global.gc();

      const memAfter = process.memoryUsage().heapUsed;
      logger.info(
        `[Grand Melee Orchestrator] Super-batch resumed (mem: ${Math.round(memAfter / 1024 / 1024)}MB, freed: ${Math.round((memBefore - memAfter) / 1024 / 1024)}MB)`,
      );

      // Re-fetch after pause
      unifiedMatch = await prisma.scheduledMatch.findFirst({
        where: { matchType: 'grand_melee', status: 'scheduled' },
        include: { participants: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!unifiedMatch) break;
    }
    // REGULAR BATCH: Every 10 matches, short pause for GC opportunity
    else if (processed > 0 && processed % BATCH_SIZE === 0) {
      logger.info(
        `[Grand Melee Orchestrator] Batch cooldown after ${processed} matches (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`,
      );
      await throttle(BATCH_COOLDOWN_MS);
      if (global.gc) global.gc();
    }
    // MATCH THROTTLE: Brief pause between each match
    else if (processed > 0) {
      await throttle(MATCH_THROTTLE_MS);
    }

    const matchId = unifiedMatch.id;
    const participantCount = unifiedMatch.participants.length;

    try {
      const result = await processGrandMeleeBattle({
        id: unifiedMatch.id,
        participants: unifiedMatch.participants,
      });
      summary.successfulMatches++;
      summary.totalRobotsInvolved += participantCount;
      summary.matchResults.push({ matchId, ...result });
    } catch (error) {
      summary.failedMatches++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`Grand Melee Match ${matchId}: ${errorMsg}`);
      logger.error(`[Grand Melee Orchestrator] Failed to process match ${matchId}:`, error);

      // Mark as error so the while loop doesn't re-fetch it in this run
      await prisma.scheduledMatch.update({
        where: { id: matchId },
        data: { status: 'error' },
      }).catch(() => {});
    }

    processed++;
  }

  // Reset any matches marked 'error' during this run back to 'scheduled' for retry next cycle
  if (summary.failedMatches > 0) {
    await prisma.scheduledMatch.updateMany({
      where: { matchType: 'grand_melee', status: 'error' },
      data: { status: 'scheduled' },
    });
    logger.info(
      `[Grand Melee Orchestrator] Reset ${summary.failedMatches} failed matches back to 'scheduled' for retry`,
    );
  }

  logger.info(
    `[Grand Melee Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`,
  );
  return summary;
}
