// ─── KotH Battle Orchestration ──────────────────────────────────────

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { KothError, KothErrorCode } from '../../errors/kothErrors';

/** Yield the event loop so Express can serve requests between heavy DB work */
const throttle = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Delay between processing each KotH match (ms) - 0 locally, 500 on server */
const MATCH_THROTTLE_MS = process.env.NODE_ENV === 'production' ? 500 : 0;
/** Number of matches to process before a longer cooldown pause */
const BATCH_SIZE = 10;
/** Cooldown pause between batches to allow GC and free memory (ms) */
const BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 5000 : 0;
/** Number of matches before a super-batch pause for heavy GC (memory safety) */
const SUPER_BATCH_SIZE = 20;
/** Long pause between super-batches to ensure memory is reclaimed (ms) */
const SUPER_BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 30000 : 0;
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
import standingsService from '../standings/standingsService';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { calculateStreamingRevenueBatch } from '../economy/streamingRevenueService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';

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
 * Calculate KotH rewards based on placement, zone score, uncontested time, and tier.
 *
 * Tier-scaled reward formula:
 *  - Credits: tierBaseReward × placementMultiplier
 *  - Fame: baseFame × tierFactor
 *  - Prestige: basePrestige × tierFactor
 *  - Zone dominance bonus: +25% to all rewards when >75% of points from uncontested zone control
 *  - Performance multiplier for winner's fame (HP-based)
 */
export function calculateKothRewards(
  placement: number,
  zoneScore: number,
  uncontestedScore: number,
  tier: string,
  winnerHPPercent?: number,
): { credits: number; prestige: number; fame: number; zoneDominanceBonus: boolean } {
  // Tier-based credit base (same as getLeagueWinReward)
  const TIER_CREDIT_BASE: Record<string, number> = {
    bronze: 7500, silver: 15000, gold: 30000,
    platinum: 60000, diamond: 115000, champion: 225000,
  };

  // Placement multipliers for credits
  const PLACEMENT_CREDIT_MULTIPLIER: Record<number, number> = {
    1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25, 6: 0.2,
  };

  // Base fame by placement
  const BASE_FAME: Record<number, number> = {
    1: 8, 2: 5, 3: 3, 4: 1, 5: 1, 6: 1,
  };

  // Base prestige by placement
  const BASE_PRESTIGE: Record<number, number> = {
    1: 15, 2: 8, 3: 3, 4: 0, 5: 0, 6: 0,
  };

  // Tier factor for fame/prestige scaling
  const TIER_FACTOR: Record<string, number> = {
    bronze: 1.0, silver: 1.5, gold: 2.0,
    platinum: 3.0, diamond: 4.5, champion: 7.0,
  };

  const creditBase = TIER_CREDIT_BASE[tier.toLowerCase()] ?? TIER_CREDIT_BASE.bronze;
  const creditMultiplier = PLACEMENT_CREDIT_MULTIPLIER[placement] ?? 0.2;
  const tierFactor = TIER_FACTOR[tier.toLowerCase()] ?? 1.0;

  let credits = Math.floor(creditBase * creditMultiplier);
  let fame = Math.floor((BASE_FAME[placement] ?? 1) * tierFactor);
  let prestige = Math.floor((BASE_PRESTIGE[placement] ?? 0) * tierFactor);

  // Performance multiplier for winner's fame
  if (placement === 1 && winnerHPPercent !== undefined) {
    let fameMultiplier = 1.0;
    if (winnerHPPercent >= 100) fameMultiplier = 2.0;
    else if (winnerHPPercent > 80) fameMultiplier = 1.5;
    else if (winnerHPPercent < 20) fameMultiplier = 1.25;
    fame = Math.round(fame * fameMultiplier);
  }

  // Zone dominance bonus: +25% when >75% of points from uncontested zone control
  const zoneDominanceBonus = zoneScore > 0 && (uncontestedScore / zoneScore) > 0.75;
  if (zoneDominanceBonus) {
    credits = Math.floor(credits * 1.25);
    fame = Math.floor(fame * 1.25);
    prestige = Math.floor(prestige * 1.25);
  }

  return { credits, prestige, fame, zoneDominanceBonus };
}

/**
 * Batch update KotH robot stats: persist HP damage and delegate standings to unified service.
 */
async function batchUpdateKothRobotStats(
  participants: PreparedParticipant[],
): Promise<void> {
  // 1. Update robot HP (battle damage persistence) in a transaction
  const hpUpdates = participants.map(p =>
    prisma.robot.update({
      where: { id: p.robot.id },
      data: {
        currentHP: Math.max(0, p.finalHP),
      },
    })
  );
  await prisma.$transaction(hpUpdates);

  // 2. Award KotH points and update standings via unified service
  for (const p of participants) {
    await standingsService.awardKothPoints({
      robotId: p.robot.id,
      placement: p.placement,
      totalParticipants: participants.length,
      kills: p.kills,
      zoneScore: p.zoneScore,
      zoneTime: p.zoneTime,
    });
  }
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
    scoreThreshold: number | null;
    timeLimit: number | null;
    zoneRadius: number | null;
    participants: Array<{ robotId: number }>;
  }
): Promise<{ winnerId: number | null; placements: Array<{ robotId: number; placement: number; zoneScore: number }> }> {
  const robotIds = match.participants.map(p => p.robotId);

  // 1. Load all participant robots with weapons
  // Spec #34: include refinements so prepareRobotForCombat can fold them
  // into the weapon's effective stats before the simulator reads them.
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
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
  // Fetch tuning bonuses in a single batch query and prepare all robots for combat
  const tuningBonusesMap = await getTuningBonusesBatch(robotIds);
  for (const robot of robots) {
    prepareRobotForCombat(robot, tuningBonusesMap.get(robot.id) ?? {});
  }

  // 2. Resolve config values (zone rotation removed — Spec #41)
  const scoreThreshold = match.scoreThreshold ?? KOTH_MATCH_DEFAULTS.scoreThreshold;
  const timeLimit = match.timeLimit ?? KOTH_MATCH_DEFAULTS.timeLimit;
  const zoneRadius = match.zoneRadius ?? KOTH_MATCH_DEFAULTS.zoneRadius;
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius;

  // 3. Build KotH game mode config, state, and tick hook
  const kothConfig: KothMatchConfig = {
    scoreThreshold,
    timeLimit,
    zoneRadius,
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
      battleLog: CombatMessageGenerator.buildKothBattleLog({
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
      }) as unknown as Prisma.InputJsonValue,
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

  // 8. Look up each robot's KotH tier from standings for tier-scaled rewards
  const robotStandings = await prisma.standing.findMany({
    where: {
      mode: 'koth',
      entityType: 'robot',
      entityId: { in: robotIds },
    },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(robotStandings.map(s => [s.entityId, s.tier]));

  // 9. Prepare all participant data for batched operations
  const preparedParticipants: PreparedParticipant[] = enrichedPlacements.map(p => {
    const robot = robots.find(r => r.id === p.robotId)!;
    const isWinner = robot.id === winnerId;
    const hpPercent = robot.maxHP > 0 ? (p.finalHP / robot.maxHP) * 100 : 0;
    const robotTier = tierByRobot.get(robot.id) ?? 'bronze';
    const rewards = calculateKothRewards(
      p.placement, p.zoneScore, p.uncontestedScore, robotTier,
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

  // 10. BATCHED: Calculate streaming revenue with single batch query (2 queries instead of 2N)
  const _cycleNumber = await getCurrentCycleNumber();
  const streamingCalcMap = await calculateStreamingRevenueBatch(
    preparedParticipants.map(p => ({ robotId: p.robot.id, userId: p.robot.userId }))
  );

  // 11. BATCHED: All currency/prestige/fame updates in a single transaction
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

  // 13. BATCHED: Update KotH robot stats
  await batchUpdateKothRobotStats(preparedParticipants);

  // 13b. Check and award achievements for all participants (deferred — non-critical path)
  // Achievement checks are not required for battle results and can run asynchronously
  // like audit logging. This removes ~12-24 sequential DB queries from the critical path.
  setImmediate(async () => {
    try {
      // Batch fetch previous battle loss data for all robots in one query
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
        prevBattleResults.map(r => [r.robotId, r.battle.winnerId !== null && r.battle.winnerId !== r.robotId])
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
          battleType: 'koth',
          battleDurationSeconds: simResult.durationSeconds,
        });
      }));
    } catch (err) {
      logger.error('[KotH] Achievement check failed (non-critical):', err);
    }
  });

  // 14. BATCHED: Log audit events (fire-and-forget for performance)
  // Audit logging is non-critical and can be done asynchronously
  setImmediate(async () => {
    try {
      for (let i = 0; i < preparedParticipants.length; i++) {
        const p = preparedParticipants[i];
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
  await prisma.scheduledMatch.update({
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

  // Count total scheduled KotH matches from unified table (Spec #40)
  const totalCount = await prisma.scheduledMatch.count({ where: { matchType: 'koth', status: 'scheduled' } });
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
  while (processed < totalCount) {
    // Fetch the next single scheduled match from unified table
    let unifiedMatch = await prisma.scheduledMatch.findFirst({
      where: { matchType: 'koth', status: 'scheduled' },
      include: { participants: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!unifiedMatch) break;

    // Map to the shape the KotH battle executor expects
    let match = {
      id: unifiedMatch.id,
      scheduledFor: unifiedMatch.scheduledFor,
      status: unifiedMatch.status,
      battleId: unifiedMatch.battleId,
      scoreThreshold: unifiedMatch.scoreThreshold,
      timeLimit: unifiedMatch.timeLimit,
      zoneRadius: unifiedMatch.zoneRadius,
      createdAt: unifiedMatch.createdAt,
      participants: unifiedMatch.participants.map(p => ({
        id: p.id,
        matchId: unifiedMatch!.id,
        robotId: p.participantId,
      })),
    };

    // SUPER-BATCH: Every 20 matches, take a long pause for memory reclamation
    if (processed > 0 && processed % SUPER_BATCH_SIZE === 0) {
      const memBefore = process.memoryUsage().heapUsed;
      logger.info(`[KotH Orchestrator] Super-batch cooldown after ${processed} matches (mem: ${Math.round(memBefore / 1024 / 1024)}MB) - waiting ${SUPER_BATCH_COOLDOWN_MS / 1000}s for GC`);
      
      if (global.gc) global.gc();
      await throttle(SUPER_BATCH_COOLDOWN_MS);
      if (global.gc) global.gc();
      
      const memAfter = process.memoryUsage().heapUsed;
      logger.info(`[KotH Orchestrator] Super-batch resumed (mem: ${Math.round(memAfter / 1024 / 1024)}MB, freed: ${Math.round((memBefore - memAfter) / 1024 / 1024)}MB)`);
      
      // Re-fetch
      unifiedMatch = await prisma.scheduledMatch.findFirst({
        where: { matchType: 'koth', status: 'scheduled' },
        include: { participants: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!unifiedMatch) break;
      match = {
        id: unifiedMatch.id,
        scheduledFor: unifiedMatch.scheduledFor,
        status: unifiedMatch.status,
        battleId: unifiedMatch.battleId,
        scoreThreshold: unifiedMatch.scoreThreshold,
        timeLimit: unifiedMatch.timeLimit,
        zoneRadius: unifiedMatch.zoneRadius,
        createdAt: unifiedMatch.createdAt,
        participants: unifiedMatch.participants.map(p => ({
          id: p.id,
          matchId: unifiedMatch!.id,
          robotId: p.participantId,
        })),
      };
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
      await prisma.scheduledMatch.update({
        where: { id: matchId },
        data: { status: 'error' },
      }).catch(() => {});
    }

    // End of match processing
    processed++;
  }

  // Reset any matches marked 'error' during this run back to 'scheduled' for retry next cycle
  if (summary.failedMatches > 0) {
    await prisma.scheduledMatch.updateMany({
      where: { matchType: 'koth', status: 'error' },
      data: { status: 'scheduled' },
    });
    logger.info(`[KotH Orchestrator] Reset ${summary.failedMatches} failed matches back to 'scheduled' for retry`);
  }

  logger.info(`[KotH Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
  return summary;
}
