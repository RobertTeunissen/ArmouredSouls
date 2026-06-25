/**
 * Tournament Battle Orchestrator
 * Handles tournament-specific battle execution and rewards
 * 
 * IMPORTANT: Tournament bye matches do NOT create battles or awards.
 * League bye matches (against "Bye Robot") are handled in battleOrchestrator.ts
 * and DO create battles with participation rewards.
 */

import { Robot, ScheduledTournamentMatch, Battle, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { simulateBattle, CombatResult } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import { calculateELOChange } from '../../utils/battleMath';
import {
  calculateTournamentBattleRewards,
  getTournamentRewardBreakdown,
} from '../../utils/tournamentRewards';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  updateRobotCombatStats,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  type UnlockedAchievement,
} from '../battle/battlePostCombat';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';

// Economic constants
const _REPAIR_COST_PER_HP = 50; // Cost to repair 1 HP

export interface TournamentBattleResult {
  battleId: number;
  winnerId: number;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1Damage: number;
  robot2Damage: number;
  durationSeconds: number;
  prestigeAwarded: number;
  fameAwarded: number;
  isByeMatch: boolean;
  achievementUnlocks: UnlockedAchievement[];
}

/**
 * Process a tournament match battle
 * 
 * Note: Tournament bye matches should NOT call this function.
 * Tournament byes are auto-completed at tournament creation (no battle, no rewards).
 * This is different from league bye matches which DO fight the "Bye Robot".
 */
export async function processTournamentBattle(
  tournamentMatch: ScheduledTournamentMatch
): Promise<TournamentBattleResult> {
  if (!tournamentMatch.participant1Id || !tournamentMatch.participant2Id) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Tournament match ${tournamentMatch.id} missing robots`,
      400,
      { matchId: tournamentMatch.id }
    );
  }

  if (tournamentMatch.isByeMatch) {
    throw new TournamentError(
      TournamentErrorCode.INVALID_MATCH_STATE,
      `Bye match ${tournamentMatch.id} should not be processed as a battle`,
      400,
      { matchId: tournamentMatch.id, isByeMatch: true }
    );
  }

  // Load both robots with weapons
  // For 1v1 tournaments (participantType='robot'), participant IDs ARE robot IDs
  // Spec #34: include refinements so prepareRobotForCombat can fold them
  // into the weapon's effective stats before the simulator reads them.
  const robot1 = await prisma.robot.findUnique({
    where: { id: tournamentMatch.participant1Id },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });

  const robot2 = await prisma.robot.findUnique({
    where: { id: tournamentMatch.participant2Id },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });

  if (!robot1 || !robot2) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Robots not found for tournament match ${tournamentMatch.id}`,
      404,
      { matchId: tournamentMatch.id, participant1Id: tournamentMatch.participant1Id, participant2Id: tournamentMatch.participant2Id }
    );
  }

  // Robots enter battles fully repaired
  // Fetch tuning bonuses in a single batch query and prepare robots for combat
  const tuningMap = await getTuningBonusesBatch([robot1.id, robot2.id]);
  prepareRobotForCombat(robot1, tuningMap.get(robot1.id) ?? {});
  prepareRobotForCombat(robot2, tuningMap.get(robot2.id) ?? {});

  // Simulate battle with tournament mode (resolves draws with HP tiebreaker)
  const combatResult = simulateBattle(robot1, robot2, true);

  // Get tournament for round information and participant count
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentMatch.tournamentId },
  });

  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentMatch.tournamentId} not found`,
      404,
      { tournamentId: tournamentMatch.tournamentId }
    );
  }

  // Count robots remaining in current round (including bye robots)
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId: tournamentMatch.tournamentId,
      round: tournament.currentRound,
    },
  });
  
  // Count all robots: regular matches (2 robots each) + bye matches (1 robot each)
  const regularMatchCount = currentRoundMatches.filter(m => !m.isByeMatch).length;
  const byeMatchCount = currentRoundMatches.filter(m => m.isByeMatch).length;
  const robotsRemaining = (regularMatchCount * 2) + byeMatchCount;

  // Create battle record with tournament context
  const battle = await createTournamentBattleRecord(
    tournamentMatch,
    robot1,
    robot2,
    combatResult,
    tournament.currentRound,
    tournament.maxRounds,
    tournament.totalParticipants,
    robotsRemaining
  );

  // Update robot stats and award rewards
  const stats1 = await updateRobotStatsForTournament(
    robot1,
    battle,
    true,
    tournament.currentRound,
    tournament.maxRounds
  );
  const stats2 = await updateRobotStatsForTournament(
    robot2,
    battle,
    false,
    tournament.currentRound,
    tournament.maxRounds
  );

  // Calculate and award streaming revenue (Requirement 16.1-16.7)
  // Tournament battles award streaming revenue using the same formula as 1v1 battles
  // No streaming revenue for bye matches (handled by isByeMatch check at function start)
  const streamingRevenue1 = await awardStreamingRevenueForParticipant(robot1.id, robot1.userId, battle.id, false);
  const streamingRevenue2 = await awardStreamingRevenueForParticipant(robot2.id, robot2.userId, battle.id, false);

  if (streamingRevenue1) {
    logger.info(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }
  if (streamingRevenue2) {
    logger.info(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }

  // Log battle_complete events to audit log - ONE EVENT PER ROBOT
  // Get participant data for audit logging
  const robot1Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot1.id } },
  });
  const robot2Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot2.id } },
  });
  
  if (!robot1Participant || !robot2Participant) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `BattleParticipant records not found for battle ${battle.id}`,
      500,
      { battleId: battle.id }
    );
  }
  
  // Determine results for each robot
  const robot1IsWinner = battle.winnerId === robot1.id;
  const robot2IsWinner = battle.winnerId === robot2.id;
  const isDraw = battle.winnerId === null;
  
  // Event 1: Robot 1's perspective
  // Event 2: Robot 2's perspective
  // Non-blocking: audit failures must never crash a battle
  try {
    await logBattleAuditEvent(
      {
        robotId: robot1.id,
        userId: robot1.userId,
        isWinner: robot1IsWinner,
        isDraw,
        damageDealt: robot1Participant.damageDealt,
        finalHP: robot1Participant.finalHP,
        yielded: robot1Participant.yielded,
        destroyed: robot1Participant.destroyed,
        credits: robot1IsWinner ? (battle.winnerReward ?? 0) : (battle.loserReward ?? 0),
        prestige: stats1.prestigeAwarded,
        fame: stats1.fameAwarded,
        eloBefore: robot1Participant.eloBefore,
        eloAfter: robot1Participant.eloAfter,
      },
      { id: battle.id, battleType: 'tournament_1v1', leagueType: 'tournament', durationSeconds: battle.durationSeconds, eloChange: battle.eloChange ?? 0 },
      robot2.id,
      streamingRevenue1?.totalRevenue || 0,
      false,
    );
  } catch (auditError) {
    logger.error(`[TournamentBattleOrchestrator] Audit log failed for robot ${robot1.id} in battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }

  try {
    await logBattleAuditEvent(
      {
        robotId: robot2.id,
        userId: robot2.userId,
        isWinner: robot2IsWinner,
        isDraw,
        damageDealt: robot2Participant.damageDealt,
        finalHP: robot2Participant.finalHP,
        yielded: robot2Participant.yielded,
        destroyed: robot2Participant.destroyed,
        credits: robot2IsWinner ? (battle.winnerReward ?? 0) : (battle.loserReward ?? 0),
        prestige: stats2.prestigeAwarded,
        fame: stats2.fameAwarded,
        eloBefore: robot2Participant.eloBefore,
        eloAfter: robot2Participant.eloAfter,
      },
      { id: battle.id, battleType: 'tournament_1v1', leagueType: 'tournament', durationSeconds: battle.durationSeconds, eloChange: battle.eloChange ?? 0 },
      robot1.id,
      streamingRevenue2?.totalRevenue || 0,
      false,
    );
  } catch (auditError) {
    logger.error(`[TournamentBattleOrchestrator] Audit log failed for robot ${robot2.id} in battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }

  // Update tournament match with result
  await prisma.scheduledTournamentMatch.update({
    where: { id: tournamentMatch.id },
    data: {
      winnerId: battle.winnerId,
      battleId: battle.id,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Check and award achievements for both robots (battle_complete + tournament_complete for winner)
  let achievementUnlocks: UnlockedAchievement[];
  {
    // Look up whether each robot lost their previous battle (for C15 "I Didn't Hear No Bell")
    const [robot1PrevLost, robot2PrevLost] = await Promise.all([
      didRobotLosePreviousBattle(robot1.id, battle.id),
      didRobotLosePreviousBattle(robot2.id, battle.id),
    ]);

    const [unlocks1, unlocks2] = await Promise.all([
      checkAndAwardAchievements(robot1.userId, robot1.id, {
        won: robot1IsWinner,
        destroyed: robot2Participant.destroyed,
        finalHpPercent: robot1.maxHP > 0 ? (robot1Participant.finalHP / robot1.maxHP) * 100 : 0,
        eloDiff: robot1Participant.eloAfter - robot1Participant.eloBefore,
        opponentElo: robot2.elo,
        yielded: robot1Participant.yielded,
        opponentYielded: robot2Participant.yielded,
        previousBattleLost: robot1PrevLost,
        damageDealt: robot1Participant.damageDealt,
        opponentDamageDealt: robot2Participant.damageDealt,
        loadoutType: robot1.loadoutType || 'single',
        stance: robot1.stance || 'balanced',
        yieldThreshold: robot1.yieldThreshold,
        hasTuning: false,
        hasMainWeapon: robot1.mainWeaponId !== null,
        battleType: 'tournament_1v1',
        battleDurationSeconds: combatResult.durationSeconds,
      }),
      checkAndAwardAchievements(robot2.userId, robot2.id, {
        won: robot2IsWinner,
        destroyed: robot1Participant.destroyed,
        finalHpPercent: robot2.maxHP > 0 ? (robot2Participant.finalHP / robot2.maxHP) * 100 : 0,
        eloDiff: robot2Participant.eloAfter - robot2Participant.eloBefore,
        opponentElo: robot1.elo,
        yielded: robot2Participant.yielded,
        opponentYielded: robot1Participant.yielded,
        previousBattleLost: robot2PrevLost,
        damageDealt: robot2Participant.damageDealt,
        opponentDamageDealt: robot1Participant.damageDealt,
        loadoutType: robot2.loadoutType || 'single',
        stance: robot2.stance || 'balanced',
        yieldThreshold: robot2.yieldThreshold,
        hasTuning: false,
        hasMainWeapon: robot2.mainWeaponId !== null,
        battleType: 'tournament_1v1',
        battleDurationSeconds: combatResult.durationSeconds,
      }),
    ]);
    achievementUnlocks = [...unlocks1, ...unlocks2];
  }

  // Get user IDs for logging
  const robot1User = await prisma.user.findUnique({ where: { id: robot1.userId }, select: { id: true } });
  const robot2User = await prisma.user.findUnique({ where: { id: robot2.userId }, select: { id: true } });
  
  // Check for kills from BattleParticipant data
  const robot1Killed = robot2Participant.destroyed;
  const robot2Killed = robot1Participant.destroyed;
  const killInfo = robot1Killed ? ` | Kill: ${robot1.name}` : (robot2Killed ? ` | Kill: ${robot2.name}` : '');
  
  const totalPrestige = stats1.prestigeAwarded + stats2.prestigeAwarded;
  const totalFame = stats1.fameAwarded + stats2.fameAwarded;
  
  logger.info(
    `[Battle] Tournament: Round ${tournament.currentRound} | ${robot1.name} (User ${robot1User?.id}) vs ${robot2.name} (User ${robot2User?.id}) | Winner: ${battle.winnerId === robot1.id ? robot1.name : robot2.name} | Rewards: ₡${battle.winnerReward?.toLocaleString() || 0} / ₡${battle.loserReward?.toLocaleString() || 0} | Prestige: +${totalPrestige} | Fame: +${totalFame}${killInfo}`
  );

  return {
    battleId: battle.id,
    winnerId: battle.winnerId as number,
    robot1FinalHP: combatResult.robot1FinalHP,
    robot2FinalHP: combatResult.robot2FinalHP,
    robot1Damage: combatResult.robot1Damage,
    robot2Damage: combatResult.robot2Damage,
    durationSeconds: combatResult.durationSeconds,
    prestigeAwarded: stats1.prestigeAwarded + stats2.prestigeAwarded,
    fameAwarded: stats1.fameAwarded + stats2.fameAwarded,
    isByeMatch: false,
    achievementUnlocks,
  };
}

/**
 * Create a Battle record for a tournament battle
 */
async function createTournamentBattleRecord(
  tournamentMatch: ScheduledTournamentMatch,
  robot1: Robot,
  robot2: Robot,
  combatResult: CombatResult,
  round: number,
  maxRounds: number,
  totalParticipants: number,
  robotsRemaining: number
): Promise<Battle> {
  const isRobot1Winner = combatResult.winnerId === robot1.id;
  const robot1ELOBefore = robot1.elo;
  const robot2ELOBefore = robot2.elo;

  // Calculate ELO changes
  const eloChanges = calculateELOChange(
    isRobot1Winner ? robot1.elo : robot2.elo,
    isRobot1Winner ? robot2.elo : robot1.elo,
    false // No draws in tournaments
  );

  const robot1ELOAfter = isRobot1Winner
    ? robot1.elo + eloChanges.winnerChange
    : robot1.elo + eloChanges.loserChange;
  const robot2ELOAfter = isRobot1Winner
    ? robot2.elo + eloChanges.loserChange
    : robot2.elo + eloChanges.winnerChange;

  const eloChange = Math.abs(eloChanges.winnerChange);

  // Calculate tournament rewards (new formula based on tournament size & progression)
  const winnerRobot = isRobot1Winner ? robot1 : robot2;
  const loserRobot = isRobot1Winner ? robot2 : robot1;
  const winnerFinalHP = isRobot1Winner ? combatResult.robot1FinalHP : combatResult.robot2FinalHP;

  const rewards = await calculateTournamentBattleRewards(
    totalParticipants,
    round,
    maxRounds,
    robotsRemaining,
    winnerFinalHP,
    winnerRobot.maxHP
  );

  // Generate battle log from REAL simulator events
  const battleLog = CombatMessageGenerator.convertBattleEvents({
    robot1Name: robot1.name,
    robot2Name: robot2.name,
    robot1ELOBefore,
    robot2ELOBefore,
    robot1ELOAfter,
    robot2ELOAfter,
    winnerName: isRobot1Winner ? robot1.name : robot2.name,
    loserName: isRobot1Winner ? robot2.name : robot1.name,
    winnerFinalHP: isRobot1Winner ? combatResult.robot1FinalHP : combatResult.robot2FinalHP,
    winnerMaxHP: winnerRobot.maxHP,
    loserFinalHP: isRobot1Winner ? combatResult.robot2FinalHP : combatResult.robot1FinalHP,
    robot1DamageDealt: combatResult.robot2Damage,
    robot2DamageDealt: combatResult.robot1Damage,
    leagueType: 'tournament',
    durationSeconds: combatResult.durationSeconds,
    // Pass real simulator events + context for narrative conversion
    simulatorEvents: combatResult.events,
    robot1Stance: robot1.stance,
    robot2Stance: robot2.stance,
    robot1MaxHP: robot1.maxHP,
    robot2MaxHP: robot2.maxHP,
    battleType: 'tournament_1v1',
  });

  // Add tournament reward breakdown to battle log
  const rewardBreakdown = getTournamentRewardBreakdown(
    rewards,
    winnerRobot.name,
    loserRobot.name,
    totalParticipants,
    round,
    maxRounds
  );
  rewardBreakdown.forEach((line, index) => {
    battleLog.push({
      timestamp: combatResult.durationSeconds + index * 0.1,
      type: 'tournament_reward',
      message: line,
    });
  });

  // Create battle record
  const battle = await prisma.battle.create({
    data: {
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      winnerId: combatResult.winnerId,
      battleType: 'tournament_1v1',
      leagueType: 'tournament', // Tournament battles use special league type
      tournamentId: tournamentMatch.tournamentId,
      tournamentRound: round,

      // Battle log
      battleLog: {
        events: battleLog,
        isTournament: true,
        round,
        maxRounds,
        isFinals: round === maxRounds,
        detailedCombatEvents: combatResult.events || [],
        // 2D arena spatial metadata
        arenaRadius: combatResult.arenaRadius,
        startingPositions: combatResult.startingPositions,
        endingPositions: combatResult.endingPositions,
      } as unknown as Prisma.InputJsonValue,
      durationSeconds: combatResult.durationSeconds,

      // Economic data
      winnerReward: rewards.winnerReward,
      loserReward: rewards.loserReward,


    },
  });

  // Create BattleParticipant records
  await prisma.battleParticipant.createMany({
    data: [
      {
        battleId: battle.id,
        robotId: robot1.id,
        team: 1,
        role: null,
        credits: isRobot1Winner ? rewards.winnerReward : rewards.loserReward,
        streamingRevenue: 0,
        eloBefore: robot1ELOBefore,
        eloAfter: robot1ELOAfter,
        prestigeAwarded: isRobot1Winner ? rewards.winnerPrestige : rewards.loserPrestige,
        fameAwarded: isRobot1Winner ? rewards.winnerFame : rewards.loserFame,
        damageDealt: combatResult.robot2Damage,
        finalHP: combatResult.robot1FinalHP,
        yielded: combatResult.winnerId !== robot1.id && combatResult.robot1FinalHP > 0,
        destroyed: combatResult.robot1FinalHP === 0,
      },
      {
        battleId: battle.id,
        robotId: robot2.id,
        team: 2,
        role: null,
        credits: isRobot1Winner ? rewards.loserReward : rewards.winnerReward,
        streamingRevenue: 0,
        eloBefore: robot2ELOBefore,
        eloAfter: robot2ELOAfter,
        prestigeAwarded: isRobot1Winner ? rewards.loserPrestige : rewards.winnerPrestige,
        fameAwarded: isRobot1Winner ? rewards.loserFame : rewards.winnerFame,
        damageDealt: combatResult.robot1Damage,
        finalHP: combatResult.robot2FinalHP,
        yielded: combatResult.winnerId !== robot2.id && combatResult.robot2FinalHP > 0,
        destroyed: combatResult.robot2FinalHP === 0,
      },
    ],
  });

  // Write pre-computed battle summary (Spec #39)
  const summaryData = computeBattleSummary({
    events: (combatResult.events || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: combatResult.durationSeconds,
    battleType: 'tournament_1v1',
    robotMaxHP: { [robot1.name]: robot1.maxHP, [robot2.name]: robot2.maxHP },
    robotNameToId: { [robot1.name]: robot1.id, [robot2.name]: robot2.id },
    robotNameToTeam: { [robot1.name]: 1, [robot2.name]: 2 },
    startingPositions: combatResult.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: combatResult.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: combatResult.arenaRadius,
  });
  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[tournament-orchestrator] Failed to write battle summary', { battleId: battle.id, error: err instanceof Error ? err.message : String(err) });
    });
  }

  return battle;
}

/**
 * Update robot stats after tournament battle.
 * Uses shared updateRobotCombatStats + awardCreditsToUser + awardPrestigeToUser.
 */
async function updateRobotStatsForTournament(
  robot: Robot,
  battle: Battle,
  isRobot1: boolean,
  _round: number,
  _maxRounds: number
): Promise<{ prestigeAwarded: number; fameAwarded: number }> {
  const isWinner = battle.winnerId === robot.id;
  
  // Get participant data from BattleParticipant table
  const participant = await prisma.battleParticipant.findUnique({
    where: {
      battleId_robotId: {
        battleId: battle.id,
        robotId: robot.id,
      },
    },
  });
  
  if (!participant) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `BattleParticipant not found for battle ${battle.id}, robot ${robot.id}`,
      500,
      { battleId: battle.id, robotId: robot.id }
    );
  }
  
  const prestigeAwarded = participant.prestigeAwarded;
  const fameAwarded = participant.fameAwarded;

  // Get opponent's participant data to check if destroyed
  const opponentId = isRobot1 ? battle.robot2Id : battle.robot1Id;
  const opponentParticipant = await prisma.battleParticipant.findUnique({
    where: {
      battleId_robotId: {
        battleId: battle.id,
        robotId: opponentId,
      },
    },
  });

  // Update robot combat stats via shared helper
  await updateRobotCombatStats({
    robotId: robot.id,
    finalHP: participant.finalHP,
    newELO: participant.eloAfter,
    isWinner,
    isDraw: false, // No draws in tournaments
    damageDealt: participant.damageDealt,
    damageTakenByOpponent: opponentParticipant?.damageDealt || 0,
    opponentDestroyed: opponentParticipant?.destroyed || false,
    // No league points for tournament battles
    fameIncrement: isWinner ? fameAwarded : 0,
    battleType: 'tournament_1v1',
    stance: robot.stance,
    loadoutType: robot.loadoutType,
  });

  // Award prestige and credits via shared helpers
  await awardPrestigeToUser(robot.userId, isWinner ? prestigeAwarded : 0);
  const reward = isWinner ? battle.winnerReward : battle.loserReward;
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(
    robot.userId,
    reward ?? 0,
    'battle_income',
    cycleNumber,
    'Tournament battle reward',
    robot.id,
  );

  return { prestigeAwarded, fameAwarded };
}
