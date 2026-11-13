// ─── KotH Battle Orchestration ──────────────────────────────────────

import prisma from '../../lib/prisma';
import { encodeBattleLog } from '../battle/battleLogCodec';
import logger from '../../config/logger';
import { resolveBelowMinimumField } from '../scheduling/thinInstanceByes';
import type { KothPlacement } from '../../types';
import { MIN_GROUP_SIZE } from './kothMatchmakingService';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';

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
  checkAndAwardAchievements,
  updateRobotCombatStats,
} from '../battle/battlePostCombat';
import {
  hasAllocatedTuning,
  isLowestElo,
  lowestHpPercent,
  lastStandingSurvivorId,
  yieldedRobotNames,
} from '../battle/battleAchievementContext';
import standingsService from '../standings/standingsService';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { defer } from '../common/deferredWork';
import {
  getLeagueWinReward,
  getTierFactor,
  KOTH_CREDIT_BASE_MULTIPLIER,
} from '../../utils/economyFormulas';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';
import { applyAndLogLoadoutFallbacks, prepareRobotsWithTuning } from '../battle/battlePreparation';
import { buildSummaryRobotMaps, writeBattleSummary } from '../battle/battleSummaryWriter';
import {
  awardPlacementBattleRewards,
  createPlacementParticipantRows,
  loadPlacementField,
  loadPreviousBattleLossMap,
  logPlacementBattleAuditEvents,
  type ForfeitedPlacement,
  type PlacementBattleParticipant,
} from '../battle/placementBattleSteps';
import {
  executePlacementMatches,
  type PlacementExecutionSummary,
  type PlacementMatchOutcome,
} from '../battle/placementMatchExecutor';

const KOTH_PLACEMENT_CREDIT_MULTIPLIERS: Record<number, number> = {
  1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25, 6: 0.2,
};
const KOTH_ZONE_DOMINANCE_MULTIPLIER = 1.25;

/** Prepared participant data for batched DB operations */
interface PreparedParticipant extends PlacementBattleParticipant {
  zoneScore: number;
  zoneTime: number;
  uncontestedScore: number;
  rewards: { credits: number; prestige: number; fame: number; zoneDominanceBonus: boolean };
}

/** One robot's KotH result in the execution summary. */
type KothPlacementResult = { robotId: number; placement: number; zoneScore: number };

/** Summary of a KotH battle execution run */
export type KothBattleExecutionSummary = PlacementExecutionSummary<KothPlacementResult>;

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
 *
 * Forfeiters get no stat update (nothing changed for them) but a 0-point
 * standings entry; every robot is recorded with `totalParticipants: N`.
 */
async function batchUpdateKothRobotStats(
  participants: PreparedParticipant[],
  forfeited: ForfeitedPlacement[],
  totalParticipants: number,
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
      totalParticipants,
      zoneScore: p.zoneScore,
      zoneTime: p.zoneTime,
    });
  }
  for (const f of forfeited) {
    await standingsService.awardKothPoints({
      robotId: f.robot.id,
      placement: f.placement,
      totalParticipants,
      zoneScore: 0,
      zoneTime: 0,
      forfeited: true,
    });
  }
}

/** What one processed KotH match produced, for the executor's counters. */
type KothMatchOutcome = PlacementMatchOutcome<KothPlacementResult>;

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
    leagueType: string | null;
    leagueInstanceId: string | null;
    scheduledFor: Date;
    participants: Array<{ robotId: number }>;
  }
): Promise<KothMatchOutcome> {
  const robotIds = match.participants.map(p => p.robotId);

  // 1. Load all participant robots with weapons (the full scheduled list; load
  // only) and partition by battle-time readiness (rule 4): robots without a
  // main weapon are placed last and never fight.
  const { ready, unready, decisions, forfeited, totalParticipants } =
    await loadPlacementField(robotIds, match.id, '[KotH]');
  const readyIds = ready.map(r => r.id);

  if (ready.length < MIN_GROUP_SIZE) {
    await resolveBelowMinimumField(match, 'koth', ready, unready);
    return { outcome: 'below_minimum', winnerId: null, placements: [], forfeitedCount: unready.length };
  }

  // 1b. Robots enter KotH battles at full HP (simulation uses maxHP, damage
  // persisted after battle). Loadout fallbacks are in memory only, and come
  // before prepareRobotForCombat reads loadoutType (rule 6).
  applyAndLogLoadoutFallbacks(ready, decisions, match.id);
  const tuningBonusesMap = await prepareRobotsWithTuning(ready);

  // 2. Resolve config values. The zone radius is written at scheduling time
  // (Season 2 backfill covers older rows), so a missing radius is a data error.
  if (match.zoneRadius === null) {
    throw new BattleError(BattleErrorCode.INVALID_BATTLE_STATE, 'KotH match has no zone radius', 500, { matchId: match.id });
  }
  const scoreThreshold = match.scoreThreshold ?? KOTH_MATCH_DEFAULTS.scoreThreshold;
  const timeLimit = match.timeLimit ?? KOTH_MATCH_DEFAULTS.timeLimit;
  const zoneRadius = match.zoneRadius;
  const arenaRadius = KOTH_MATCH_DEFAULTS.arenaRadius;

  // 3. Build KotH game mode config, state, and tick hook
  const kothConfig: KothMatchConfig = {
    scoreThreshold,
    timeLimit,
    zoneRadius,
    participantCount: ready.length,
    matchId: match.id,
  };

  const gameModeConfig = buildKothGameModeConfig(kothConfig);
  // Forfeiters have no combat state and no score entry.
  const gameModeState = buildKothInitialState(kothConfig, readyIds);

  const scoreState = gameModeState.customData!.scoreState as KothScoreState;
  const zoneState = gameModeState.customData!.zoneState as KothZoneState;

  // Wire the tick hook — KotH-specific per-tick logic (zone scoring, penalties)
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

  const simResult = simulateBattleMulti(ready as RobotWithWeapons[], battleConfig);

  // 5. Build enriched placements from KotH score state + final combat states
  // (placements 1..ready.length; forfeiters follow at ready.length+1..N)
  const enrichedPlacements = buildEnrichedPlacements(scoreState, simResult.finalStates ?? []);
  const forfeitedLogPlacements = forfeited.map(f => ({
    robotId: f.robot.id,
    robotName: f.robot.name,
    placement: f.placement,
    zoneScore: 0,
    zoneTime: 0,
    kills: 0,
    destroyed: false,
  }));

  const winnerId = simResult.winnerId ?? (enrichedPlacements.length > 0 ? enrichedPlacements[0].robotId : null);
  const winReason = simResult.kothMetadata?.winReason ?? 'time_limit';

  // 6. Determine 1st and 2nd place for Battle record backward compat
  const first = enrichedPlacements[0];
  const winnerRobot = ready.find(r => r.id === first.robotId)!;

  // Pass position records directly (keyed by robot name) to buildKothBattleLog
  const startPosRecord = simResult.startingPositions ?? {};
  const endPosRecord = simResult.endingPositions ?? {};

  // 7. Create Battle record with full spatial data
  const battle = await prisma.battle.create({
    data: {
      winnerId: winnerRobot.id,
      battleType: 'koth',
      leagueType: 'koth',
      ...(await encodeBattleLog(CombatMessageGenerator.buildKothBattleLog({
        events: simResult.events,
        participantCount: totalParticipants,
        arenaRadius,
        startingPositions: startPosRecord,
        endingPositions: endPosRecord,
        scoreThreshold,
        zoneRadius,
        placements: [
          ...enrichedPlacements.map(p => ({
            robotId: p.robotId,
            robotName: p.robotName,
            placement: p.placement,
            zoneScore: p.zoneScore,
            zoneTime: p.zoneTime,
            kills: p.kills,
            destroyed: p.destroyed,
          })),
          ...forfeitedLogPlacements,
        ],
      }))),
      durationSeconds: simResult.durationSeconds,
      winnerReward: 0,
      loserReward: 0,

    },
  });

  // 8. Look up each ready robot's KotH tier from standings for tier-scaled rewards
  // (forfeiters earn nothing)
  const robotStandings = await prisma.standing.findMany({
    where: {
      mode: 'koth',
      entityType: 'robot',
      entityId: { in: readyIds },
    },
    select: { entityId: true, tier: true },
  });
  const tierByRobot = new Map(robotStandings.map(s => [s.entityId, s.tier]));

  // 9. Prepare all participant data for batched operations.
  // A yield ends a robot's match with HP left (`destroyed` stays false), so it
  // is read from the combat events and recorded on the participant row.
  const yieldedNames = yieldedRobotNames(simResult.events);
  const preparedParticipants: PreparedParticipant[] = enrichedPlacements.map(p => {
    const robot = ready.find(r => r.id === p.robotId)!;
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
      yielded: !p.destroyed && yieldedNames.has(robot.name),
      isWinner,
      tier: robotTier,
      rewards,
    };
  });

  // 9. BATCHED: Create all BattleParticipant records in one operation
  // (forfeiters: last places, nothing paid, HP untouched — they were never prepared)
  await createPlacementParticipantRows(battle.id, preparedParticipants, forfeited);

  await recordCombatBuilds(battle.id, 'koth', ready);

  // Write pre-computed battle summary (Spec #39). The hit-grade and id maps are
  // event-driven, so they cover the ready robots only.
  const kothPlacementsForSummary: KothPlacement[] = [
    ...enrichedPlacements.map(p => ({
      robotId: p.robotId, robotName: p.robotName, placement: p.placement,
      zoneScore: p.zoneScore, zoneTime: p.zoneTime, kills: p.kills, destroyed: p.destroyed,
    })),
    ...forfeitedLogPlacements.map(p => ({ ...p, forfeited: true })),
  ];
  await writeBattleSummary(battle.id, {
    events: simResult.events,
    duration: simResult.durationSeconds,
    battleType: 'koth',
    ...buildSummaryRobotMaps(ready, () => 1), // KotH has no teams — all on side 1
    kothPlacements: kothPlacementsForSummary,
    kothData: { participantCount: totalParticipants, scoreThreshold },
    startingPositions: startPosRecord as Record<string, { x: number; y: number }>,
    endingPositions: endPosRecord as Record<string, { x: number; y: number }>,
    arenaRadius,
  }, '[koth-orchestrator]');

  // 11. One atomic financial transaction for stable battle income, per-robot
  // streaming, stable prestige, and fame. KotH must not combine these deltas.
  const streamingCalcMap = await awardPlacementBattleRewards({
    battleId: battle.id,
    mode: 'koth',
    description: 'KotH battle reward',
    participants: preparedParticipants,
    placementComponent: (p) => ({
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
    }),
  });

  // 13. BATCHED: Update KotH robot stats (+ forfeiters' 0-point standings)
  await batchUpdateKothRobotStats(preparedParticipants, forfeited, totalParticipants);

  // 13b. Check and award achievements for all participants (deferred — non-critical path)
  // Achievement checks are not required for battle results and can run asynchronously
  // like audit logging. This removes ~12-24 sequential DB queries from the critical path.
  defer('koth achievements', async () => {
    try {
      // Batch fetch previous battle loss data for all robots in one query
      const prevLostMap = await loadPreviousBattleLossMap(preparedParticipants.map(p => p.robot.id), battle.id);

      await Promise.all(preparedParticipants.map(p => {
        const prevLost = prevLostMap.get(p.robot.id) ?? false;
        return checkAndAwardAchievements(p.robot.userId, p.robot.id, {
          won: p.isWinner,
          destroyed: p.destroyed,
          finalHpPercent: p.robot.maxHP > 0 ? (p.finalHP / p.robot.maxHP) * 100 : 0,
          eloChange: 0,
          opponentElo: 0,
          yielded: p.yielded,
          opponentYielded: false,
          previousBattleLost: prevLost,
          damageDealt: p.damageDealt,
          opponentDamageDealt: 0,
          loadoutType: (p.robot as unknown as { loadoutType?: string }).loadoutType || 'single',
          stance: (p.robot as unknown as { stance?: string }).stance || 'balanced',
          yieldThreshold: p.robot.yieldThreshold,
          hasTuning: hasAllocatedTuning(tuningBonusesMap.get(p.robot.id)),
          hasMainWeapon: p.robot.mainWeaponId !== null,
          battleType: 'koth',
          battleDurationSeconds: simResult.durationSeconds,
          battleId: battle.id,
          placement: p.placement,
          fieldSize: preparedParticipants.length,
          killsThisBattle: p.kills,
          // L39: the robot left alone when the last-standing phase began, and
          // the winner. Not inferred from the end reason: a yielded robot can
          // still win on score, and a sole survivor can win on the score
          // threshold before the countdown runs out.
          lastStanding: p.isWinner && lastStandingSurvivorId(simResult.events) === p.robot.id,
          // Zone points accrue at 1 per second held uncontested.
          uncontestedSeconds: p.uncontestedScore,
          isLowestEloInField: isLowestElo(p.robot.id, preparedParticipants.map(q => q.robot)),
          minHpPercent: lowestHpPercent(simResult.events, p.robot.name, p.robot.maxHP, p.finalHP),
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
      await logPlacementBattleAuditEvents({
        battleId: battle.id,
        mode: 'koth',
        durationSeconds: simResult.durationSeconds,
        participants: preparedParticipants,
        forfeited,
        streamingCalcMap,
        extras: (p) => ({
          kothPlacement: p.placement,
          kothZoneScore: p.zoneScore,
          kothZoneTime: p.zoneTime,
          kothKills: p.kills,
          kothZoneDominanceBonus: p.rewards.zoneDominanceBonus,
        }),
      });
    } catch (err) {
      logger.error('[KotH] Audit logging failed (non-critical):', err);
    }
  });

  // 15. Mark match completed
  await prisma.scheduledMatch.update({
    where: { id: match.id },
    data: { status: 'completed', battleId: battle.id },
  });

  logger.info(`[KotH] Match #${match.id} complete: Winner=${winnerRobot.name}, ${ready.length} fought, ${forfeited.length} forfeited, Battle #${battle.id}, Duration=${simResult.durationSeconds}s, Reason=${winReason}`);

  return {
    outcome: 'fought',
    winnerId,
    placements: [
      ...enrichedPlacements.map(p => ({ robotId: p.robotId, placement: p.placement, zoneScore: p.zoneScore })),
      ...forfeited.map(f => ({ robotId: f.robot.id, placement: f.placement, zoneScore: 0 })),
    ],
    forfeitedCount: forfeited.length,
  };
}

/**
 * Execute all scheduled KotH battles through the shared placement-mode
 * executor (one match at a time, paced for memory; byes and failures handled
 * there).
 */
export async function executeScheduledKothBattles(_scheduledFor?: Date): Promise<KothBattleExecutionSummary> {
  logger.info('[KotH Orchestrator] Executing scheduled KotH battles');
  return executePlacementMatches<KothPlacementResult>({
    mode: 'koth',
    logTag: '[KotH Orchestrator]',
    label: 'KotH',
    processMatch: (match) => processKothBattle({
      id: match.id,
      // The below-minimum byes are created in this instance (§5.8).
      leagueType: match.leagueType,
      leagueInstanceId: match.leagueInstanceId,
      scoreThreshold: match.scoreThreshold,
      timeLimit: match.timeLimit,
      zoneRadius: match.zoneRadius,
      scheduledFor: match.scheduledFor,
      participants: match.participants.map(p => ({ robotId: p.participantId })),
    }),
  });
}
