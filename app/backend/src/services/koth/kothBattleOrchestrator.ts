// ─── KotH Battle Orchestration ──────────────────────────────────────

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { resolvePlacementBye } from '../scheduling/thinInstanceByes';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
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
  updateRobotCombatStats,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  awardBattleStreamingRevenue,
} from '../battle/battlePostCombat';
import standingsService from '../standings/standingsService';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { calculateStreamingRevenueBatch } from '../economy/streamingRevenueService';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { defer } from '../common/deferredWork';
import type { PlacementRewardComponent } from '../../types/financialTypes';
import {
  getLeagueWinReward,
  getTierFactor,
  KOTH_CREDIT_BASE_MULTIPLIER,
} from '../../utils/economyFormulas';

const KOTH_PLACEMENT_CREDIT_MULTIPLIERS: Record<number, number> = {
  1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25, 6: 0.2,
};
const KOTH_ZONE_DOMINANCE_MULTIPLIER = 1.25;

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
  tier: string;
  rewards: { credits: number; prestige: number; fame: number; zoneDominanceBonus: boolean };
}

/** Summary of a KotH battle execution run */
export interface KothBattleExecutionSummary {
  totalMatches: number;
  successfulMatches: number;
  /**
   * Bye_Events resolved this run (Spec #49).
   *
   * A sibling of `successfulMatches`, not a subset: the three counters
   * partition `totalMatches`, so `successfulMatches` keeps meaning
   * "combat was simulated" — which is what an operator reads when
   * diagnosing a cycle. `matchResults.length` therefore equals
   * `successfulMatches + byeMatches`.
   */
  byeMatches: number;
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
 *  - Credits: tierBaseReward × 1.5 × placementMultiplier
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
  // Placement multipliers for credits
  const creditMultiplier = KOTH_PLACEMENT_CREDIT_MULTIPLIERS[placement] ?? 0.2;
  const BASE_FAME: Record<number, number> = {
    1: 8, 2: 5, 3: 3, 4: 1, 5: 1, 6: 1,
  };

  // Base prestige by placement
  const BASE_PRESTIGE: Record<number, number> = {
    1: 15, 2: 8, 3: 3, 4: 0, 5: 0, 6: 0,
  };

  const creditBase = getLeagueWinReward(tier);
  const tierFactor = getTierFactor(tier);

  // Rounded, not floored: the three-way product hits binary-fraction artifacts
  // (7500 × 1.5 × 0.7 floors to 7874 rather than 7875).
  let credits = Math.round(creditBase * KOTH_CREDIT_BASE_MULTIPLIER * creditMultiplier);
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
    credits = Math.floor(credits * KOTH_ZONE_DOMINANCE_MULTIPLIER);
    fame = Math.floor(fame * KOTH_ZONE_DOMINANCE_MULTIPLIER);
    prestige = Math.floor(prestige * KOTH_ZONE_DOMINANCE_MULTIPLIER);
  }

  return { credits, prestige, fame, zoneDominanceBonus };
}

/**
 * Batch update KotH robot stats: persist HP damage and delegate standings to unified service.
 */
async function batchUpdateKothRobotStats(
  participants: PreparedParticipant[],
): Promise<void> {
  // 1. Update robot combat stats via unified function (skipBattleCounters for KotH)
  for (const p of participants) {
    await updateRobotCombatStats({
      robotId: p.robot.id,
      finalHP: p.finalHP,
      combatMaxHP: p.robot.maxHP,
      newELO: p.robot.elo, // KotH doesn't use ELO
      isWinner: p.isWinner,
      isDraw: false, // KotH never draws
      damageDealt: p.damageDealt,
      damageTakenByOpponent: p.robot.maxHP - p.finalHP,
      opponentsDestroyed: p.kills,
      fameIncrement: 0, // Fame handled separately in reward distribution
      battleType: 'koth',
      stance: p.robot.stance,
      loadoutType: p.robot.loadoutType,
      skipBattleCounters: true,
    });
  }

  // 2. Award KotH points and update standings via unified service
  for (const p of participants) {
    await standingsService.awardKothPoints({
      robotId: p.robot.id,
      placement: p.placement,
      totalParticipants: participants.length,
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
  const winnerRobot = robots.find(r => r.id === first.robotId)!;

  // Pass position records directly (keyed by robot name) to buildKothBattleLog
  const startPosRecord = simResult.startingPositions ?? {};
  const endPosRecord = simResult.endingPositions ?? {};

  // 7. Create Battle record with full spatial data
  const battle = await prisma.battle.create({
    data: {
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
      tier: robotTier,
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

  // Write pre-computed battle summary (Spec #39)
  const robotMaxHP: Record<string, number> = {};
  const robotNameToId: Record<string, number> = {};
  const robotNameToTeam: Record<string, number> = {};
  for (const robot of robots) {
    robotMaxHP[robot.name] = robot.maxHP;
    robotNameToId[robot.name] = robot.id;
    robotNameToTeam[robot.name] = 1; // KotH has no teams — all on side 1
  }
  const kothPlacementsForSummary = enrichedPlacements.map(p => ({
    robotId: p.robotId, robotName: p.robotName, placement: p.placement,
    zoneScore: p.zoneScore, zoneTime: p.zoneTime, kills: p.kills, destroyed: p.destroyed,
  }));
  const summaryData = computeBattleSummary({
    events: (simResult.events || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: simResult.durationSeconds,
    battleType: 'koth',
    robotMaxHP,
    robotNameToId,
    robotNameToTeam,
    kothPlacements: kothPlacementsForSummary,
    kothData: { participantCount: robots.length, scoreThreshold },
    startingPositions: startPosRecord as Record<string, { x: number; y: number }>,
    endingPositions: endPosRecord as Record<string, { x: number; y: number }>,
    arenaRadius,
  });
  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[koth-orchestrator] Failed to write battle summary', { battleId: battle.id, error: err instanceof Error ? err.message : String(err) });
    });
  }

  // 11. One atomic financial transaction for stable battle income, per-robot
  // streaming, stable prestige, and fame. KotH must not combine these deltas.
  const cycleNumber = await getCurrentCycleNumber();
  const streamingCalcMap = await calculateStreamingRevenueBatch(
    preparedParticipants.map((participant) => ({
      robotId: participant.robot.id,
      userId: participant.robot.userId,
    })),
  );
  const creditsByUser = new Map<number, number>();
  const placementRewardsByUser = new Map<number, PlacementRewardComponent[]>();
  const prestigeByUser = new Map<number, number>();
  const fameByRobot = new Map<number, number>();

  preparedParticipants.forEach((p) => {
    if (p.rewards.credits > 0) {
      creditsByUser.set(p.robot.userId, (creditsByUser.get(p.robot.userId) ?? 0) + p.rewards.credits);
      const placementRewards = placementRewardsByUser.get(p.robot.userId) ?? [];
      placementRewards.push({
        mode: 'koth',
        robotId: p.robot.id,
        tier: p.tier,
        placement: p.placement,
        credits: p.rewards.credits,
        tierBaseReward: getLeagueWinReward(p.tier),
        modeBaseMultiplier: KOTH_CREDIT_BASE_MULTIPLIER,
        placementMultiplier: KOTH_PLACEMENT_CREDIT_MULTIPLIERS[p.placement] ?? 0.2,
        zoneScore: p.zoneScore,
        zoneTime: p.zoneTime,
        uncontestedScore: p.uncontestedScore,
        zoneDominanceBonus: p.rewards.zoneDominanceBonus,
        zoneDominanceMultiplier: p.rewards.zoneDominanceBonus ? KOTH_ZONE_DOMINANCE_MULTIPLIER : 1,
      });
      placementRewardsByUser.set(p.robot.userId, placementRewards);
    }
    if (p.rewards.prestige > 0) {
      prestigeByUser.set(p.robot.userId, (prestigeByUser.get(p.robot.userId) ?? 0) + p.rewards.prestige);
    }
    if (p.rewards.fame > 0) {
      fameByRobot.set(p.robot.id, (fameByRobot.get(p.robot.id) ?? 0) + p.rewards.fame);
    }
  });

  await prisma.$transaction(async (tx) => {
    for (const [userId, credits] of creditsByUser) {
      await awardCreditsWithLedger(
        userId,
        credits,
        'battle_income',
        cycleNumber,
        'KotH battle reward',
        undefined,
        { battleId: battle.id, placementMode: 'koth' },
        {
          battleId: battle.id,
          mode: 'koth',
          tier: 'placement_aggregate',
          outcome: 'placement',
          placement: null,
          participationFloor: 0,
          winComponent: 0,
          teamSize: 1,
          isBye: false,
          placementRewardComponents: placementRewardsByUser.get(userId),
          tx,
        },
      );
    }

    for (const [userId, prestige] of prestigeByUser) {
      await awardPrestigeToUser(userId, prestige, cycleNumber, {
        source: 'battle',
        mode: 'koth',
        battleId: battle.id,
        tx,
      });
    }

    for (const [robotId, fame] of fameByRobot) {
      await tx.robot.update({
        where: { id: robotId },
        data: { fame: { increment: fame } },
      });
    }

    for (const participant of preparedParticipants) {
      const streamingCalc = streamingCalcMap.get(participant.robot.id);
      if (!streamingCalc) continue;
      await awardBattleStreamingRevenue(
        participant.robot.userId,
        streamingCalc,
        cycleNumber,
        battle.id,
        'koth',
        tx,
      );
      await tx.battleParticipant.update({
        where: {
          battleId_robotId: { battleId: battle.id, robotId: participant.robot.id },
        },
        data: { streamingRevenue: streamingCalc.totalRevenue },
      });
    }
  });

  // 13. BATCHED: Update KotH robot stats
  await batchUpdateKothRobotStats(preparedParticipants);

  // 13b. Check and award achievements for all participants (deferred — non-critical path)
  // Achievement checks are not required for battle results and can run asynchronously
  // like audit logging. This removes ~12-24 sequential DB queries from the critical path.
  defer('koth achievements', async () => {
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
          eloChange: 0,
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
  defer('koth audit', async () => {
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
    byeMatches: 0,
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
      isByeMatch: unifiedMatch.isByeMatch,
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
        // Carried at BOTH mapping sites — the super-batch cooldown re-fetches
        // and re-maps, so omitting it here would silently drop bye detection
        // for every match after the first twenty.
        isByeMatch: unifiedMatch.isByeMatch,
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
      // A Thin_Instance bye resolves without combat (Spec #49). One entry point,
      // identity only — no per-orchestrator adapter.
      if (match.isByeMatch === true) {
        await resolvePlacementBye(match.id, 'koth', match.participants.map(p => p.robotId));
        summary.byeMatches++;
        summary.totalRobotsInvolved += participantCount;
        summary.matchResults.push({ matchId, winnerId: null, placements: [] });
        processed++;
        continue;
      }

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

  logger.info(`[KotH Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.byeMatches} byes, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
  return summary;
}
