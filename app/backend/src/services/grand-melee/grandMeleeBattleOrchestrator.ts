// ─── Grand Melee Battle Orchestration ───────────────────────────────

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import logger from '../../config/logger';
import { resolveBelowMinimumField, resolvePlacementBye } from '../scheduling/thinInstanceByes';
import { handleMatchFailure } from '../battle/matchFailurePolicy';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import { applyLoadoutFallbacks, partitionPlacementField } from '../battle/combatReadiness';
import type { KothPlacement } from '../../types';
import { MIN_GROUP_SIZE } from './grandMeleeMatchmakingService';
import { countKillsByRobot } from '../../shared/utils/battleStatistics';
import { simulateBattleMulti, RobotWithWeapons, BattleConfig, SpatialCombatResult, SpatialRobotCombatState, SpatialCombatEvent } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import {
  logBattleAuditEvent,
  checkAndAwardAchievements,
  updateRobotCombatStats,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  awardBattleStreamingRevenue,
} from '../battle/battlePostCombat';
import standingsService from '../standings/standingsService';
import { calculateStreamingRevenueBatch } from '../economy/streamingRevenueService';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { calculateGrandMeleeRewards, GRAND_MELEE_BASE_MULTIPLIER, GRAND_MELEE_CREDIT_MULTIPLIER } from './grandMeleeRewards';
import { getLeagueWinReward } from '../../utils/economyFormulas';
import type { PlacementRewardComponent } from '../../types/financialTypes';
import schedulingService from '../scheduling/schedulingService';
import { defer } from '../common/deferredWork';

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

/** Persisted formula fact for placements outside the top-ten reward curve. */
const GRAND_MELEE_PARTICIPATION_FLOOR_MULTIPLIER = 0.2;

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
  tier: string;
  rewards: { credits: number; prestige: number; fame: number; lpDelta: number };
}

/** A robot without a main weapon, placed last without fighting (rule 4). */
interface ForfeitedPlacement {
  robot: RobotWithWeapons;
  placement: number;
}

/** What one processed Grand Melee match produced, for the executor's counters. */
interface GrandMeleeMatchOutcome {
  outcome: 'fought' | 'below_minimum';
  winnerId: number | null;
  placements: Array<{ robotId: number; placement: number; kills: number }>;
  forfeitedCount: number;
}

/** Summary of a Grand Melee battle execution run */
export interface GrandMeleeBattleExecutionSummary {
  totalMatches: number;
  successfulMatches: number;
  /**
   * Bye_Events resolved this run (Spec #49).
   *
   * A sibling of `successfulMatches`, not a subset: the four counters
   * (successful, bye, below-minimum, failed) partition `totalMatches`, so
   * `successfulMatches` keeps meaning "combat was simulated" — which is what
   * an operator reads when diagnosing a cycle. `matchResults.length`
   * therefore equals `successfulMatches + byeMatches + belowMinimumMatches`.
   */
  byeMatches: number;
  /**
   * Matches whose ready field fell below the minimum at battle time: the
   * forfeiters got a forfeit-only battle and the ready robots byes.
   */
  belowMinimumMatches: number;
  failedMatches: number;
  /** Robots placed last without fighting because they had no main weapon. */
  forfeitedRobots: number;
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
  // Event types that take a robot out of the match. `yield` counts for ordering
  // but never for kill credit — the robot removed itself.
  const ELIMINATION_TYPES = new Set(['destroyed', 'robot_eliminated', 'yield']);

  // Build elimination time map: robotName → timestamp of elimination.
  //
  // Spec #46 R4.16: this and the kill map below were both empty in production.
  // The `destroyed` event emitted by the shared simulation loop carried neither
  // `attacker` nor `defender`, so every lookup missed: kills came out as zero
  // for every robot, and elimination ordering silently degraded to a pure
  // damage-dealt sort. Both fields are now populated at the emission site.
  const eliminationTimeMap = new Map<string, number>();
  for (const event of events) {
    if (ELIMINATION_TYPES.has(event.type) && event.defender) {
      // Use earliest elimination event for each robot
      if (!eliminationTimeMap.has(event.defender)) {
        eliminationTimeMap.set(event.defender, event.timestamp);
      }
    }
  }

  // Kill credit comes from the shared attribution helper so that every mode
  // counts a destruction the same way.
  const killsByRobot = countKillsByRobot(
    events as unknown as Parameters<typeof countKillsByRobot>[0],
  );

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
    kills: killsByRobot[state.robot.name] ?? 0,
    damageDealt: state.totalDamageDealt,
    finalHP: Math.max(0, state.currentHP),
    destroyed: !state.isAlive,
  }));
}

// ─── Batch Robot Stats Update ───────────────────────────────────────

/**
 * Batch update Grand Melee robot stats: persist HP/damage and delegate standings.
 *
 * Forfeiters get no stat update (nothing changed for them) but a 0-point
 * standings entry; every robot is recorded with `totalParticipants: N`.
 */
async function batchUpdateGrandMeleeRobotStats(
  participants: PreparedParticipant[],
  durationSeconds: number,
  forfeited: ForfeitedPlacement[],
  totalParticipants: number,
): Promise<void> {
  // 1. Update robot combat stats via unified function (skipBattleCounters for Grand Melee)
  for (const p of participants) {
    await updateRobotCombatStats({
      robotId: p.robot.id,
      finalHP: p.finalHP,
      combatMaxHP: p.robot.maxHP,
      newELO: p.robot.elo, // Grand Melee doesn't use ELO
      isWinner: p.isWinner,
      isDraw: false, // Grand Melee never draws
      damageDealt: p.damageDealt,
      damageTakenByOpponent: p.robot.maxHP - p.finalHP,
      opponentsDestroyed: p.kills,
      fameIncrement: 0, // Fame handled separately in reward distribution
      battleType: 'grand_melee',
      stance: p.robot.stance,
      loadoutType: p.robot.loadoutType,
      skipBattleCounters: true,
      // Spec #46 R8: the shared helper owns grandMeleeWins/grandMeleeTop3. These
      // were previously two inline `prisma.robot.update` calls here, which
      // violated the unified post-battle update rule.
      placement: p.placement,
    });
  }

  // 2. Award Grand Melee points and update standings via unified service
  for (const p of participants) {
    await standingsService.awardGrandMeleePoints({
      robotId: p.robot.id,
      placement: p.placement,
      totalParticipants,
      damageDealt: p.damageDealt,
      survivalTime: durationSeconds,
    });
  }
  for (const f of forfeited) {
    await standingsService.awardGrandMeleePoints({
      robotId: f.robot.id,
      placement: f.placement,
      totalParticipants,
      damageDealt: 0,
      survivalTime: 0,
      forfeited: true,
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
    leagueType: string | null;
    leagueInstanceId: string | null;
    scheduledFor: Date;
  },
): Promise<GrandMeleeMatchOutcome> {
  const robotIds = match.participants.map(p => p.participantId);

  // 1. Load all participant robots with weapons + refinements (the full scheduled list; load only)
  const loaded = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });
  const loadedIds = new Set(loaded.map(r => r.id));
  const missing = robotIds.filter(id => !loadedIds.has(id));
  if (missing.length > 0) {
    logger.warn(`[Grand Melee] Match #${match.id}: robot(s) ${missing.join(', ')} no longer exist, dropped from the field`);
  }

  // 2. Battle-time readiness (rule 4): robots without a main weapon are placed
  // last and never fight. The partition comes BEFORE tuning and preparation, so
  // a forfeiter keeps its real currentHP (prepareRobotForCombat sets full HP).
  const { ready, forfeited: unready, decisions } = partitionPlacementField(loaded);
  const readyIds = ready.map(r => r.id);
  const totalParticipants = ready.length + unready.length;
  const forfeited: ForfeitedPlacement[] = [...unready]
    .sort((a, b) => a.id - b.id)
    .map((robot, i) => ({ robot, placement: ready.length + 1 + i }));

  if (ready.length < MIN_GROUP_SIZE) {
    await resolveBelowMinimumField(match, 'grand_melee', ready, unready);
    return { outcome: 'below_minimum', winnerId: null, placements: [], forfeitedCount: unready.length };
  }

  // 3. Batch-fetch tuning bonuses and prepare the ready robots for combat
  const tuningBonusesMap = await getTuningBonusesBatch(readyIds);
  // In memory only, and before prepareRobotForCombat reads loadoutType (rule 6).
  for (const robotId of applyLoadoutFallbacks(ready, decisions)) {
    const decision = decisions.find(d => d.robotId === robotId);
    logger.warn('[Battle] Loadout fallback', {
      matchId: match.id,
      robotId,
      storedLoadout: decision?.loadoutFallback?.storedLoadout,
      battleLoadout: 'single',
    });
  }
  for (const robot of ready) {
    prepareRobotForCombat(robot, tuningBonusesMap.get(robot.id) ?? {});
  }

  // 4. Compute arena radius from formula: 16 + (N - 2) * 3, sized for the robots that fight
  const arenaRadius = 16 + (ready.length - 2) * 3;

  // 5. Run unified simulation (pure elimination, no game mode config)
  const battleConfig: BattleConfig = {
    allowDraws: false,
    arenaRadius,
  };

  const simResult = simulateBattleMulti(ready as RobotWithWeapons[], battleConfig);

  // 6. Compute placements from elimination order + HP tiebreaker
  // (placements 1..ready.length; forfeiters follow at ready.length+1..N)
  const finalStates = simResult.finalStates ?? [];
  const placements = computePlacements(simResult, finalStates, simResult.events);
  const forfeitedLogPlacements = forfeited.map(f => ({
    robotId: f.robot.id,
    robotName: f.robot.name,
    placement: f.placement,
    zoneScore: 0,
    zoneTime: 0,
    kills: 0,
    destroyed: false,
  }));

  const winnerId = placements.length > 0 ? placements[0].robotId : null;
  const winnerRobot = ready.find(r => r.id === winnerId);

  // 7. Look up each ready robot's Grand Melee tier from standings for reward
  // calculation (forfeiters earn nothing; the winner is always ready)
  const robotStandings = await prisma.standing.findMany({
    where: {
      mode: 'grand_melee',
      entityType: 'robot',
      entityId: { in: readyIds },
    },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(robotStandings.map(s => [s.entityId, s.tier]));

  // 8. Prepare all participant data for batched operations
  const preparedParticipants: PreparedParticipant[] = placements.map(p => {
    const robot = ready.find(r => r.id === p.robotId)!;
    const isWinner = robot.id === winnerId;
    const hpPercent = robot.maxHP > 0 ? (p.finalHP / robot.maxHP) * 100 : 0;
    const robotTier = tierByRobot.get(robot.id) ?? 'bronze';
    const rewards = calculateGrandMeleeRewards(
      p.placement,
      robotTier,
      totalParticipants,
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
      tier: robotTier,
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
        participantCount: totalParticipants,
        arenaRadius,
        startingPositions: startPosRecord,
        endingPositions: endPosRecord,
        scoreThreshold: 0, // Grand Melee has no score threshold
        zoneRadius: 0, // Grand Melee has no zone
        placements: [
          ...placements.map(p => ({
            robotId: p.robotId,
            robotName: p.robotName,
            placement: p.placement,
            zoneScore: 0,
            zoneTime: 0,
            kills: p.kills,
            destroyed: p.destroyed,
          })),
          ...forfeitedLogPlacements,
        ],
      }) as unknown as Prisma.InputJsonValue,
      durationSeconds: simResult.durationSeconds,
      winnerReward: 0,
      loserReward: 0,
    },
  });

  // 10. Create BattleParticipant records for all robots
  // (forfeiters: last places, nothing paid, HP untouched — they were never prepared)
  await prisma.battleParticipant.createMany({
    data: [
      ...preparedParticipants.map(p => ({
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
      ...forfeited.map(f => ({
        battleId: battle.id,
        robotId: f.robot.id,
        team: 1,
        placement: f.placement,
        role: null,
        credits: 0,
        streamingRevenue: 0,
        eloBefore: f.robot.elo,
        eloAfter: f.robot.elo,
        prestigeAwarded: 0,
        fameAwarded: 0,
        damageDealt: 0,
        finalHP: f.robot.currentHP,
        yielded: false,
        destroyed: false,
        forfeited: true,
      })),
    ],
  });

  // 11. Write pre-computed battle summary (Spec #39). The hit-grade and id maps
  // are event-driven, so they cover the ready robots only.
  const robotMaxHP: Record<string, number> = {};
  const robotNameToId: Record<string, number> = {};
  const robotNameToTeam: Record<string, number> = {};
  for (const robot of ready) {
    robotMaxHP[robot.name] = robot.maxHP;
    robotNameToId[robot.name] = robot.id;
    robotNameToTeam[robot.name] = 1; // Grand Melee has no teams — all on side 1
  }

  // Reuse kothPlacements field shape for Grand Melee placement data
  const kothPlacementsForSummary: KothPlacement[] = [
    ...placements.map(p => ({
      robotId: p.robotId,
      robotName: p.robotName,
      placement: p.placement,
      zoneScore: 0,
      zoneTime: 0,
      kills: p.kills,
      destroyed: p.destroyed,
    })),
    ...forfeitedLogPlacements.map(p => ({ ...p, forfeited: true })),
  ];

  const summaryData = computeBattleSummary({
    events: (simResult.events || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: simResult.durationSeconds,
    battleType: 'grand_melee',
    robotMaxHP,
    robotNameToId,
    robotNameToTeam,
    kothPlacements: kothPlacementsForSummary,
    kothData: { participantCount: totalParticipants, scoreThreshold: 0 },
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
  const streamingCalcMap = await calculateStreamingRevenueBatch(
    preparedParticipants.map(p => ({ robotId: p.robot.id, userId: p.robot.userId })),
  );

  // 13. Atomic stable income, per-robot streaming, prestige, and fame updates.
  const creditsByUser = new Map<number, number>();
  const placementRewardsByUser = new Map<number, PlacementRewardComponent[]>();
  const prestigeByUser = new Map<number, number>();
  const fameByRobot = new Map<number, number>();

  preparedParticipants.forEach((p) => {
    if (p.rewards.credits > 0) {
      creditsByUser.set(p.robot.userId, (creditsByUser.get(p.robot.userId) ?? 0) + p.rewards.credits);
      const placementRewards = placementRewardsByUser.get(p.robot.userId) ?? [];
      const participationFloorApplied = p.placement > 10;
      placementRewards.push({
        mode: 'grand_melee',
        robotId: p.robot.id,
        tier: p.tier,
        placement: p.placement,
        credits: p.rewards.credits,
        tierBaseReward: getLeagueWinReward(p.tier),
        modeBaseMultiplier: GRAND_MELEE_BASE_MULTIPLIER,
        placementMultiplier: GRAND_MELEE_CREDIT_MULTIPLIER[p.placement] ?? GRAND_MELEE_PARTICIPATION_FLOOR_MULTIPLIER,
        totalParticipants,
        participationFloorApplied,
        participationFloorMultiplier: participationFloorApplied ? GRAND_MELEE_PARTICIPATION_FLOOR_MULTIPLIER : 0,
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

  await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    for (const [userId, credits] of creditsByUser) {
      await awardCreditsWithLedger(
        userId,
        credits,
        'battle_income',
        financialCycleNumber,
        'Grand Melee battle reward',
        undefined,
        { battleId: battle.id, placementMode: 'grand_melee' },
        {
          battleId: battle.id,
          mode: 'grand_melee',
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
      await awardPrestigeToUser(userId, prestige, financialCycleNumber, {
        source: 'battle',
        mode: 'grand_melee',
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
        financialCycleNumber,
        battle.id,
        'grand_melee',
        tx,
      );
      await tx.battleParticipant.update({
        where: {
          battleId_robotId: { battleId: battle.id, robotId: participant.robot.id },
        },
        data: { streamingRevenue: streamingCalc.totalRevenue },
      });
    }
  }, { timeout: 30_000 });

  // 15. Update Grand Melee robot stats + standings
  await batchUpdateGrandMeleeRobotStats(preparedParticipants, simResult.durationSeconds, forfeited, totalParticipants);

  // 16. Check and award achievements (deferred — non-critical path)
  defer('grand melee achievements', async () => {
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
          // Spec #46 R8: `grand_melee_win_high_hp` (L30 Untouchable) keys on
          // placement rather than `won`, because Grand Melee resolves by
          // placement across 20 robots.
          placement: p.placement,
          eloChange: 0,
          subjectEloBefore: p.robot.elo,
          opponentEloBefore: p.robot.elo,
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
  defer('grand melee audit', async () => {
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
      // Forfeiters: their last-place loss is on the record too.
      for (const f of forfeited) {
        await logBattleAuditEvent(
          {
            robotId: f.robot.id,
            userId: f.robot.userId,
            isWinner: false,
            isDraw: false,
            damageDealt: 0,
            finalHP: f.robot.currentHP,
            yielded: false,
            destroyed: false,
            credits: 0,
            prestige: 0,
            fame: 0,
            eloBefore: f.robot.elo,
            eloAfter: f.robot.elo,
          },
          { id: battle.id, battleType: 'grand_melee', leagueType: 'grand_melee', durationSeconds: simResult.durationSeconds, eloChange: 0 },
          null,
          0,
          false,
          { kothPlacement: f.placement, forfeit: true },
        );
      }
    } catch (err) {
      logger.error('[Grand Melee] Audit logging failed (non-critical):', err);
    }
  });

  // 18. Mark match completed
  await schedulingService.completeMatch(match.id, battle.id);

  logger.info(
    `[Grand Melee] Match #${match.id} complete: Winner=${winnerRobot?.name ?? 'none'}, ${ready.length} fought, ${forfeited.length} forfeited, Battle #${battle.id}, Duration=${simResult.durationSeconds}s`,
  );

  return {
    outcome: 'fought',
    winnerId,
    placements: [
      ...placements.map(p => ({ robotId: p.robotId, placement: p.placement, kills: p.kills })),
      ...forfeited.map(f => ({ robotId: f.robot.id, placement: f.placement, kills: 0 })),
    ],
    forfeitedCount: forfeited.length,
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
    byeMatches: 0,
    belowMinimumMatches: 0,
    failedMatches: 0,
    forfeitedRobots: 0,
    totalRobotsInvolved: 0,
    matchResults: [],
    errors: [],
  };

  let processed = 0;
  // In-run exclusion set: a match whose cancel write fails (handleMatchFailure
  // returns cancelled: false) stays 'scheduled' and must not be re-fetched in
  // this run.
  const attempted: number[] = [];

  // Process one match at a time: fetch → execute → release memory → repeat
  while (processed < totalCount) {
    // Fetch the next single scheduled match
    let unifiedMatch = await prisma.scheduledMatch.findFirst({
      where: { matchType: 'grand_melee', status: 'scheduled', id: { notIn: [...attempted] } },
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
        where: { matchType: 'grand_melee', status: 'scheduled', id: { notIn: [...attempted] } },
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
    attempted.push(matchId);
    const participantCount = unifiedMatch.participants.length;

    try {
      // A Thin_Instance bye resolves without combat (Spec #49).
      if (unifiedMatch.isByeMatch === true) {
        await resolvePlacementBye(
          unifiedMatch.id,
          'grand_melee',
          unifiedMatch.participants.map(p => p.participantId),
          unifiedMatch.leagueType ?? undefined,
        );
        summary.byeMatches++;
        summary.totalRobotsInvolved += participantCount;
        summary.matchResults.push({ matchId, winnerId: null, placements: [] });
        processed++;
        continue;
      }

      const result = await processGrandMeleeBattle({
        id: unifiedMatch.id,
        participants: unifiedMatch.participants,
        leagueType: unifiedMatch.leagueType,
        leagueInstanceId: unifiedMatch.leagueInstanceId,
        scheduledFor: unifiedMatch.scheduledFor,
      });
      if (result.outcome === 'below_minimum') summary.belowMinimumMatches++;
      else summary.successfulMatches++;
      summary.forfeitedRobots += result.forfeitedCount;
      summary.totalRobotsInvolved += participantCount;
      summary.matchResults.push({ matchId, winnerId: result.winnerId, placements: result.placements });
    } catch (error) {
      // Rule 7: cancel the match (no retry, no reward), log, carry on.
      summary.failedMatches++;
      const { errorSummary } = await handleMatchFailure({
        mode: 'grand_melee',
        ref: { source: 'scheduled_match', id: matchId },
        error,
        participants: unifiedMatch.participants.map(p => p.participantId),
      });
      summary.errors.push(`Grand Melee Match ${matchId}: ${errorSummary}`);
    }

    processed++;
  }

  logger.info(
    `[Grand Melee Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.byeMatches} byes, ${summary.belowMinimumMatches} below minimum, ${summary.forfeitedRobots} robots forfeited, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`,
  );
  return summary;
}
