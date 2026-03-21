// ─── KotH Battle Orchestration ──────────────────────────────────────

import prisma from '../lib/prisma';
import logger from '../config/logger';
import { simulateBattleMulti, RobotWithWeapons, BattleConfig } from './combatSimulator';
import {
  buildKothGameModeConfig,
  buildKothInitialState,
  buildKothTickHook,
  buildEnrichedPlacements,
  KothMatchConfig,
  KOTH_MATCH_DEFAULTS,
  KothScoreState,
  KothZoneState,
} from './arena/kothEngine';
import { getCurrentCycleNumber } from './leagueBattleOrchestrator';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardFameToRobot,
} from './battlePostCombat';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { calculateRepairCost, calculateAttributeSum } from '../utils/robotCalculations';

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
 * Update cumulative KotH stats on a robot record.
 */
async function updateKothRobotStats(
  robotId: number,
  placement: number,
  zoneScore: number,
  zoneTime: number,
  kills: number,
  isWinner: boolean,
): Promise<void> {
  const robot = await prisma.robot.findUnique({ where: { id: robotId } });
  if (!robot) return;

  const currentBest = (robot as Record<string, unknown>).kothBestPlacement as number | null;
  const newBestPlacement = currentBest === null || currentBest === 0
    ? placement
    : Math.min(currentBest, placement);

  const currentStreak = ((robot as Record<string, unknown>).kothCurrentWinStreak as number) ?? 0;
  const currentBestStreak = ((robot as Record<string, unknown>).kothBestWinStreak as number) ?? 0;
  const newWinStreak = isWinner ? currentStreak + 1 : 0;
  const newBestStreak = Math.max(currentBestStreak, newWinStreak);

  await prisma.robot.update({
    where: { id: robotId },
    data: {
      kothMatches: { increment: 1 },
      kothWins: isWinner ? { increment: 1 } : undefined,
      kothTotalZoneScore: { increment: zoneScore },
      kothTotalZoneTime: { increment: zoneTime },
      kothKills: { increment: kills },
      kothBestPlacement: newBestPlacement,
      kothCurrentWinStreak: newWinStreak,
      kothBestWinStreak: newBestStreak,
    },
  });
}

/**
 * Process a single KotH match using the unified N-robot simulator.
 * Builds KotH game mode config + state + tick hook, calls simulateBattleMulti(),
 * then maps the result to DB records.
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
    throw new Error(`KotH match ${match.id}: expected at least 5 robots, found ${robots.length}`);
  }

  // 1b. Auto-repair all participants to full HP/shield before battle (full cost, no manual discount)
  for (const robot of robots) {
    if (robot.currentHP < robot.maxHP || robot.currentShield < robot.maxShield) {
      const damageTaken = robot.maxHP - robot.currentHP;
      if (damageTaken > 0) {
        const sumOfAllAttributes = calculateAttributeSum(robot);
        const damagePercent = (damageTaken / robot.maxHP) * 100;
        const hpPercent = (robot.currentHP / robot.maxHP) * 100;

        // Get repair bay and medical bay levels for discount calculation
        const facilities = await prisma.facility.findMany({
          where: { userId: robot.userId, facilityType: { in: ['repair_bay', 'medical_bay'] } },
        });
        const repairBayLevel = facilities.find(f => f.facilityType === 'repair_bay')?.level ?? 0;
        const medicalBayLevel = facilities.find(f => f.facilityType === 'medical_bay')?.level ?? 0;
        const activeRobotCount = await prisma.robot.count({
          where: { userId: robot.userId, NOT: { name: 'Bye Robot' } },
        });

        const repairCost = calculateRepairCost(
          sumOfAllAttributes, damagePercent, hpPercent,
          repairBayLevel, medicalBayLevel, activeRobotCount,
        );

        if (repairCost > 0) {
          await prisma.user.update({
            where: { id: robot.userId },
            data: { currency: { decrement: repairCost } },
          });
          logger.info(`[KotH] Auto-repair: Robot ${robot.id} (${robot.name}) cost ₡${repairCost}`);
        }
      }

      // Restore to full HP and shield for the battle
      robot.currentHP = robot.maxHP;
      robot.currentShield = robot.maxShield;

      await prisma.robot.update({
        where: { id: robot.id },
        data: { currentHP: robot.maxHP, currentShield: robot.maxShield, repairCost: 0 },
      });
    }
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

  // 8. Create BattleParticipant records + calculate rewards
  for (const p of enrichedPlacements) {
    const robot = robots.find(r => r.id === p.robotId)!;
    const isWinner = robot.id === winnerId;
    const hpPercent = robot.maxHP > 0 ? (p.finalHP / robot.maxHP) * 100 : 0;
    const rewards = calculateKothRewards(
      p.placement, p.zoneScore, p.uncontestedScore,
      isWinner ? hpPercent : undefined,
    );

    await prisma.battleParticipant.create({
      data: {
        battleId: battle.id,
        robotId: robot.id,
        team: 1, // KotH is free-for-all, no team affiliation
        placement: p.placement, // 1-6 final placement
        role: null,
        credits: rewards.credits,
        streamingRevenue: 0,
        eloBefore: robot.elo,
        eloAfter: robot.elo,
        prestigeAwarded: rewards.prestige,
        fameAwarded: rewards.fame,
        damageDealt: p.damageDealt,
        finalHP: p.finalHP,
        yielded: false,
        destroyed: p.destroyed,
      },
    });

    if (rewards.credits > 0) {
      await awardCreditsToUser(robot.userId, rewards.credits);
    }
    if (rewards.fame > 0) {
      await awardFameToRobot(robot.id, rewards.fame);
    }
    if (rewards.prestige > 0) {
      await awardPrestigeToUser(robot.userId, rewards.prestige);
    }

    const streamingCalc = await awardStreamingRevenueForParticipant(robot.id, robot.userId, battle.id, false);

    await updateKothRobotStats(robot.id, p.placement, p.zoneScore, p.zoneTime, p.kills, isWinner);

    await logBattleAuditEvent(
      {
        robotId: robot.id,
        userId: robot.userId,
        isWinner,
        isDraw: false,
        damageDealt: p.damageDealt,
        finalHP: p.finalHP,
        yielded: false,
        destroyed: p.destroyed,
        credits: rewards.credits,
        prestige: rewards.prestige,
        fame: rewards.fame,
        eloBefore: robot.elo,
        eloAfter: robot.elo,
      },
      { id: battle.id, battleType: 'koth', leagueType: 'koth', durationSeconds: simResult.durationSeconds, eloChange: 0 },
      null, // KotH has no single opponent
      streamingCalc?.totalRevenue || 0,
      false,
      {
        kothPlacement: p.placement,
        kothZoneScore: p.zoneScore,
        kothZoneTime: p.zoneTime,
        kothKills: p.kills,
        kothZoneDominanceBonus: rewards.zoneDominanceBonus,
      },
    );
  }

  // 9. Mark match completed
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
 */
export async function executeScheduledKothBattles(scheduledFor?: Date): Promise<KothBattleExecutionSummary> {
  logger.info('[KotH Orchestrator] Executing scheduled KotH battles');

  const scheduledMatches = await prisma.scheduledKothMatch.findMany({
    where: { status: 'scheduled' },
    include: { participants: true },
    orderBy: { createdAt: 'asc' },
  });

  logger.info(`[KotH Orchestrator] Found ${scheduledMatches.length} KotH matches to execute`);

  const summary: KothBattleExecutionSummary = {
    totalMatches: scheduledMatches.length,
    successfulMatches: 0,
    failedMatches: 0,
    totalRobotsInvolved: 0,
    matchResults: [],
    errors: [],
  };

  for (const match of scheduledMatches) {
    try {
      const result = await processKothBattle(match);
      summary.successfulMatches++;
      summary.totalRobotsInvolved += match.participants.length;
      summary.matchResults.push({ matchId: match.id, ...result });
    } catch (error) {
      summary.failedMatches++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`KotH Match ${match.id}: ${errorMsg}`);
      logger.error(`[KotH Orchestrator] Failed to process match ${match.id}:`, error);
    }
  }

  logger.info(`[KotH Orchestrator] Execution complete: ${summary.successfulMatches} successful, ${summary.failedMatches} failed`);
  return summary;
}
