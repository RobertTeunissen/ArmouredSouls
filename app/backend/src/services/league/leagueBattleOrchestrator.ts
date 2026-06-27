import { Robot, Battle, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { simulateBattle, type CombatEvent } from '../battle/combatSimulator';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import {
  getLeagueWinReward,
  getParticipationReward,
  calculateBattleWinnings,
  getPrestigeMultiplier,
} from '../../utils/economyCalculations';
import {
  calculateELOChange,
} from '../../utils/battleMath';
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
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import standingsService from '../standings/standingsService';

// Re-export so existing consumers don't break
export { getCurrentCycleNumber };

// ─── Scheduled Match Shape (mapped from unified table) ───────────────────────

/** Shape of a scheduled 1v1 league match as mapped from the unified scheduling table. */
interface ScheduledLeagueMatchData {
  id: number;
  robot1Id: number;
  robot2Id: number;
  leagueType: string;
  leagueInstanceId?: string;
  scheduledFor: Date;
  status: string;
  battleId: number | null;
  createdAt: Date;
  _unifiedMatchId?: number;
}

// League points
const LEAGUE_POINTS_WIN = 3;
const LEAGUE_POINTS_LOSS = -1;
const LEAGUE_POINTS_DRAW = 1;

// Battle simulation constants
const _WINNER_DAMAGE_PERCENT = 0.15; // Winners lose 15% HP
const _LOSER_DAMAGE_PERCENT = 0.40; // Losers lose 40% HP
// Bye battles: zero damage to player (bye exists only for scheduling fairness)
const _MIN_BATTLE_DURATION = 20; // Minimum battle duration in seconds
const _BATTLE_DURATION_VARIANCE = 25; // Random variance added to duration
const BYE_BATTLE_DURATION = 15; // Fixed duration for bye battles

export interface BattleResult {
  battleId: number;
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1Damage: number;
  robot2Damage: number;
  durationSeconds: number;
  isDraw: boolean;
  isByeMatch: boolean;
  combatEvents?: CombatEvent[]; // Detailed combat events for admin debugging
  // 2D arena spatial metadata
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
}

export interface BattleExecutionSummary {
  totalBattles: number;
  successfulBattles: number;
  failedBattles: number;
  byeBattles: number;
  errors: string[];
  totalStreamingRevenue?: number;
  reputationSummary?: {
    totalPrestigeAwarded: number;
    totalFameAwarded: number;
    prestigeByLeague: Record<string, number>;
    fameByLeague: Record<string, number>;
  };
}

/**
 * Calculate prestige award for a battle win
 */
function calculatePrestigeForBattle(leagueType: string, isDraw: boolean, isByeMatch: boolean): number {
  if (isDraw || isByeMatch) return 0; // No prestige for draws or bye matches
  
  const prestigeByLeague: Record<string, number> = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };
  
  return prestigeByLeague[leagueType] || 0;
}

/**
 * Calculate fame award for a battle win
 */
function calculateFameForBattle(
  leagueType: string,
  winnerRobot: Robot,
  winnerFinalHP: number,
  isDraw: boolean,
  isByeMatch: boolean
): number {
  if (isDraw || isByeMatch) return 0; // No fame for draws or bye matches
  
  // Base fame by league
  const fameByLeague: Record<string, number> = {
    bronze: 2,
    silver: 5,
    gold: 10,
    platinum: 15,
    diamond: 25,
    champion: 40,
  };
  
  let baseFame = fameByLeague[leagueType] || 0;
  
  // Performance bonuses
  const hpPercent = winnerFinalHP / winnerRobot.maxHP;
  
  if (winnerFinalHP === winnerRobot.maxHP) {
    // Perfect victory (no HP damage taken)
    baseFame *= 2.0;
  } else if (hpPercent > 0.8) {
    // Dominating victory (>80% HP remaining)
    baseFame *= 1.5;
  } else if (hpPercent < 0.2) {
    // Comeback victory (<20% HP remaining)
    baseFame *= 1.25;
  }
  
  return Math.round(baseFame);
}

/**
 * Simulate a battle using the comprehensive combat simulator
 * Uses ALL 23 robot attributes - ELO is NOT used in combat calculations
 */
function simulateBattleWrapper(robot1: Robot, robot2: Robot): BattleResult {
  const combatResult = simulateBattle(robot1, robot2);
  
  return {
    battleId: 0, // Will be set after creating battle record
    winnerId: combatResult.winnerId,
    robot1FinalHP: combatResult.robot1FinalHP,
    robot2FinalHP: combatResult.robot2FinalHP,
    robot1Damage: combatResult.robot1Damage,
    robot2Damage: combatResult.robot2Damage,
    durationSeconds: combatResult.durationSeconds,
    isDraw: combatResult.isDraw,
    isByeMatch: false,
    combatEvents: combatResult.events, // Store detailed combat events for debugging
    arenaRadius: combatResult.arenaRadius,
    startingPositions: combatResult.startingPositions,
    endingPositions: combatResult.endingPositions,
  };
}

/**
 * Process a bye-match using the same pattern as team battles:
 * - Real robot's ID fills both FK slots on the Battle record
 * - Only one BattleParticipant is created (for the real robot)
 * - Stats, LP, credits, and ELO are awarded normally for the winner
 * - No prestige/fame/streaming/achievements for bye matches
 */
async function processByeBattle(scheduledMatch: ScheduledLeagueMatchData): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number; achievementUnlocks: UnlockedAchievement[] }> {
  const realRobotId = scheduledMatch.robot1Id < 0 ? scheduledMatch.robot2Id : scheduledMatch.robot1Id;

  const robot = await prisma.robot.findUnique({
    where: { id: realRobotId },
  });

  if (!robot) {
    throw new BattleError(
      BattleErrorCode.ROBOT_NOT_ELIGIBLE,
      `Real robot not found for bye match ${scheduledMatch.id}`,
      404,
      { matchId: scheduledMatch.id, robotId: realRobotId }
    );
  }

  // ELO change: player always wins vs bye robot (ELO 1000)
  const byeElo = 1000;
  const eloChanges = calculateELOChange(robot.elo, byeElo, false);
  const newElo = robot.elo + eloChanges.winnerChange;

  // Participation reward only (no win bonus for bye matches)
  const participationReward = getParticipationReward(scheduledMatch.leagueType);

  // Create Battle record — real robot ID fills both FK slots (same pattern as team battles)
  const battle = await prisma.battle.create({
    data: {
      robot1Id: robot.id,
      robot2Id: robot.id, // Self-reference avoids FK violation for fabricated bye robot
      winnerId: robot.id,
      battleType: 'league_1v1',
      leagueType: scheduledMatch.leagueType,
      leagueInstanceId: scheduledMatch.leagueInstanceId,
      battleLog: {
        events: [{ timestamp: 0, type: 'bye_match', message: `${robot.name} wins by walkover (bye)` }],
        isByeMatch: true,
        detailedCombatEvents: [],
      } as unknown as Prisma.InputJsonValue,
      durationSeconds: BYE_BATTLE_DURATION,
      winnerReward: participationReward,
      loserReward: 0,

    },
  });

  // Single BattleParticipant for the real robot only (skip bye robot — same as team battles)
  await prisma.battleParticipant.create({
    data: {
      battleId: battle.id,
      robotId: robot.id,
      team: 1,
      role: null,
      credits: participationReward,
      streamingRevenue: 0,
      eloBefore: robot.elo,
      eloAfter: newElo,
      prestigeAwarded: 0,
      fameAwarded: 0,
      damageDealt: 0,
      finalHP: robot.currentHP,
      yielded: false,
      destroyed: false,
    },
  });

  // Update robot combat stats (ELO, win counters)
  await updateRobotCombatStats({
    robotId: robot.id,
    finalHP: robot.currentHP,
    newELO: newElo,
    isWinner: true,
    isDraw: false,
    damageDealt: 0,
    damageTakenByOpponent: 0,
    opponentDestroyed: false,
    fameIncrement: 0,
    battleType: 'league_1v1',
    stance: robot.stance,
    loadoutType: robot.loadoutType,
  });

  // Update standings (LP +3 for a win) via unified service
  await standingsService.recordBattleResult({
    entityType: 'robot',
    entityId: robot.id,
    mode: 'league_1v1',
    outcome: 'win',
    lpDelta: LEAGUE_POINTS_WIN,
  });

  // Award participation credits
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(
    robot.userId,
    participationReward,
    'battle_income',
    cycleNumber,
    'League 1v1 bye-match participation',
    robot.id,
  );

  // Mark the scheduled match as completed with the battle reference
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: { status: 'completed', battleId: battle.id },
  });

  logger.info(`[Battle] Bye-match: ${robot.name} (User ${robot.userId}) auto-win | LP +${LEAGUE_POINTS_WIN} | ELO ${robot.elo} → ${newElo} | ₡${participationReward}`);

  return {
    battleId: battle.id,
    winnerId: robot.id,
    robot1FinalHP: robot.currentHP,
    robot2FinalHP: 0,
    robot1Damage: 0,
    robot2Damage: 0,
    durationSeconds: BYE_BATTLE_DURATION,
    isDraw: false,
    isByeMatch: true,
    prestigeAwarded: 0,
    fameAwarded: 0,
    achievementUnlocks: [],
  };
}

/**
 * Create a Battle record in the database
 */
async function createBattleRecord(
  scheduledMatch: ScheduledLeagueMatchData,
  robot1: Robot,
  robot2: Robot,
  result: BattleResult
): Promise<Battle> {
  const isRobot1Winner = result.winnerId === robot1.id;
  const robot1ELOBefore = robot1.elo;
  const robot2ELOBefore = robot2.elo;
  
  // Calculate ELO changes
  const eloChanges = calculateELOChange(
    isRobot1Winner ? robot1.elo : robot2.elo,
    isRobot1Winner ? robot2.elo : robot1.elo,
    result.isDraw
  );
  
  const robot1ELOAfter = isRobot1Winner 
    ? robot1.elo + eloChanges.winnerChange 
    : robot1.elo + eloChanges.loserChange;
  const robot2ELOAfter = isRobot1Winner 
    ? robot2.elo + eloChanges.loserChange 
    : robot2.elo + eloChanges.winnerChange;
  
  const eloChange = Math.abs(eloChanges.winnerChange);
  
  // Calculate rewards based on league tier and prestige
  const baseWinRewardAmount = getLeagueWinReward(scheduledMatch.leagueType);
  const participationReward = getParticipationReward(scheduledMatch.leagueType);
  
  // Get users for prestige multiplier (parallel fetch)
  const [robot1User, robot2User] = await Promise.all([
    prisma.user.findUnique({ where: { id: robot1.userId }, select: { id: true, prestige: true } }),
    prisma.user.findUnique({ where: { id: robot2.userId }, select: { id: true, prestige: true } }),
  ]);
  
  // NOTE: Repair costs are NOT calculated here anymore.
  // They are calculated by RepairService when repairs are actually triggered.
  // This ensures accurate costs based on current damage and facility levels.
  
  // Winner gets midpoint of league range + participation reward, with prestige bonus
  // Loser gets only participation reward
  let robot1Reward = participationReward;
  let robot2Reward = participationReward;
  
  if (!result.isDraw && !result.isByeMatch) {
    if (isRobot1Winner && robot1User) {
      const baseWinReward = baseWinRewardAmount;
      const winRewardWithPrestige = calculateBattleWinnings(baseWinReward, robot1User.prestige);
      robot1Reward = winRewardWithPrestige + participationReward;
    } else if (!isRobot1Winner && robot2User) {
      const baseWinReward = baseWinRewardAmount;
      const winRewardWithPrestige = calculateBattleWinnings(baseWinReward, robot2User.prestige);
      robot2Reward = winRewardWithPrestige + participationReward;
    }
  } else if (result.isDraw) {
    // Draw: both get participation reward only (no win reward)
    robot1Reward = participationReward;
    robot2Reward = participationReward;
  }
  
  // Generate battle log with combat messages from REAL simulator events
  const battleLog = CombatMessageGenerator.convertBattleEvents({
    robot1Name: robot1.name,
    robot2Name: robot2.name,
    robot1ELOBefore,
    robot2ELOBefore,
    robot1ELOAfter,
    robot2ELOAfter,
    winnerName: isRobot1Winner ? robot1.name : robot2.name,
    loserName: isRobot1Winner ? robot2.name : robot1.name,
    winnerFinalHP: isRobot1Winner ? result.robot1FinalHP : result.robot2FinalHP,
    winnerMaxHP: isRobot1Winner ? robot1.maxHP : robot2.maxHP,
    loserFinalHP: isRobot1Winner ? result.robot2FinalHP : result.robot1FinalHP,
    robot1DamageDealt: result.robot2Damage,
    robot2DamageDealt: result.robot1Damage,
    leagueType: scheduledMatch.leagueType,
    durationSeconds: result.durationSeconds,
    // Pass real simulator events + context for narrative conversion
    simulatorEvents: result.combatEvents,
    robot1Stance: robot1.stance,
    robot2Stance: robot2.stance,
    robot1MaxHP: robot1.maxHP,
    robot2MaxHP: robot2.maxHP,
    battleType: 'league_1v1',
  });
  
  // Add financial reward details to battle log
  const winnerPrestige = isRobot1Winner ? robot1User?.prestige || 0 : robot2User?.prestige || 0;
  const winnerReward = isRobot1Winner ? robot1Reward : robot2Reward;
  const loserReward = isRobot1Winner ? robot2Reward : robot1Reward;
  const prestigeMultiplier = getPrestigeMultiplier(winnerPrestige);
  
  // Add reward summary to battle log
  if (!result.isDraw && !result.isByeMatch) {
    const baseWinReward = baseWinRewardAmount;
    const prestigeBonus = winnerReward - participationReward - baseWinReward;
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_summary',
      message: `💰 Financial Rewards Summary`,
    });
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_detail',
      message: `   Winner (${isRobot1Winner ? robot1.name : robot2.name}): ₡${winnerReward.toLocaleString()}`,
    });
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_breakdown',
      message: `      • League Base (${scheduledMatch.leagueType}): ₡${baseWinReward.toLocaleString()}`,
    });
    
    if (prestigeBonus > 0) {
      battleLog.push({
        timestamp: result.durationSeconds,
        type: 'reward_breakdown',
        message: `      • Prestige Bonus (${Math.round((prestigeMultiplier - 1) * 100)}%): +₡${prestigeBonus.toLocaleString()}`,
      });
    }
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_breakdown',
      message: `      • Participation: ₡${participationReward.toLocaleString()}`,
    });
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_detail',
      message: `   Loser (${isRobot1Winner ? robot2.name : robot1.name}): ₡${loserReward.toLocaleString()}`,
    });
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_breakdown',
      message: `      • Participation: ₡${participationReward.toLocaleString()}`,
    });
  } else if (result.isDraw) {
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_summary',
      message: `💰 Financial Rewards Summary (Draw)`,
    });
    
    battleLog.push({
      timestamp: result.durationSeconds,
      type: 'reward_detail',
      message: `   Both robots: ₡${participationReward.toLocaleString()} (participation only)`,
    });
  }
  
  // Create battle record
  const battle = await prisma.battle.create({
    data: {
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      winnerId: result.winnerId,
      battleType: 'league_1v1',
      leagueType: scheduledMatch.leagueType,
      leagueInstanceId: scheduledMatch.leagueInstanceId, // From scheduled match (standings-derived)
      
      // Battle log with combat messages AND detailed combat events for admin debugging
      battleLog: {
        events: battleLog,
        isByeMatch: result.isByeMatch,
        detailedCombatEvents: result.combatEvents || [], // Admin debugging: formula breakdowns, attribute usage
        // 2D arena spatial metadata
        arenaRadius: result.arenaRadius,
        startingPositions: result.startingPositions,
        endingPositions: result.endingPositions,
      } as unknown as Prisma.InputJsonValue,
      durationSeconds: result.durationSeconds,
      
      // Economic data
      winnerReward: isRobot1Winner ? robot1Reward : robot2Reward,
      loserReward: isRobot1Winner ? robot2Reward : robot1Reward,
      

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
        credits: robot1Reward,
        streamingRevenue: 0, // Will be updated later
        eloBefore: robot1ELOBefore,
        eloAfter: robot1ELOAfter,
        prestigeAwarded: 0, // Will be updated after updateRobotStats
        fameAwarded: 0, // Will be updated after updateRobotStats
        damageDealt: result.robot2Damage,
        finalHP: result.robot1FinalHP,
        yielded: result.winnerId !== robot1.id && result.robot1FinalHP > 0,
        destroyed: result.robot1FinalHP === 0,
      },
      {
        battleId: battle.id,
        robotId: robot2.id,
        team: 2,
        role: null,
        credits: robot2Reward,
        streamingRevenue: 0, // Will be updated later
        eloBefore: robot2ELOBefore,
        eloAfter: robot2ELOAfter,
        prestigeAwarded: 0, // Will be updated after updateRobotStats
        fameAwarded: 0, // Will be updated after updateRobotStats
        damageDealt: result.robot1Damage,
        finalHP: result.robot2FinalHP,
        yielded: result.winnerId !== robot2.id && result.robot2FinalHP > 0,
        destroyed: result.robot2FinalHP === 0,
      },
    ],
  });

  // Write pre-computed battle summary (Spec #39 — permanent stats for overview tab)
  const summaryData = computeBattleSummary({
    events: (result.combatEvents || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: result.durationSeconds,
    battleType: 'league_1v1',
    robotMaxHP: { [robot1.name]: robot1.maxHP, [robot2.name]: robot2.maxHP },
    robotNameToId: { [robot1.name]: robot1.id, [robot2.name]: robot2.id },
    robotNameToTeam: { [robot1.name]: 1, [robot2.name]: 2 },
    startingPositions: result.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: result.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: result.arenaRadius,
  });
  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[league-orchestrator] Failed to write battle summary', { battleId: battle.id, error: err instanceof Error ? err.message : String(err) });
    });
  }

  return battle;
}

/**
 * Update robot stats after battle and award prestige/fame.
 * Uses shared updateRobotCombatStats + awardCreditsToUser + awardPrestigeToUser.
 * Accepts pre-fetched participant data to avoid redundant DB queries.
 */
async function updateRobotStats(
  robot: Robot,
  battle: Battle,
  participant: { finalHP: number; eloAfter: number; damageDealt: number; yielded: boolean; destroyed: boolean },
  opponentParticipant: { damageDealt: number; destroyed: boolean } | null,
  isByeMatch: boolean
): Promise<{ prestigeAwarded: number; fameAwarded: number }> {
  const isWinner = battle.winnerId === robot.id;
  const isDraw = battle.winnerId === null;
  
  const finalHP = participant.finalHP;
  const newELO = participant.eloAfter;
  
  // Calculate league points change
  let leaguePointsChange: number;
  if (isDraw) {
    leaguePointsChange = LEAGUE_POINTS_DRAW;
  } else if (isWinner) {
    leaguePointsChange = LEAGUE_POINTS_WIN;
  } else {
    leaguePointsChange = LEAGUE_POINTS_LOSS;
  }
  
  // Calculate prestige and fame awards
  let prestigeAwarded = 0;
  let fameAwarded = 0;
  
  if (isWinner) {
    prestigeAwarded = calculatePrestigeForBattle(battle.leagueType, isDraw, isByeMatch);
    fameAwarded = calculateFameForBattle(battle.leagueType, robot, finalHP, isDraw, isByeMatch);
  }
  
  // Update robot combat stats via shared helper
  await updateRobotCombatStats({
    robotId: robot.id,
    finalHP,
    newELO,
    isWinner,
    isDraw,
    damageDealt: participant.damageDealt,
    damageTakenByOpponent: opponentParticipant?.damageDealt || 0,
    opponentDestroyed: opponentParticipant?.destroyed || false,
    fameIncrement: isWinner ? fameAwarded : 0,
    battleType: 'league_1v1',
    stance: robot.stance,
    loadoutType: robot.loadoutType,
  });

  // Update standings (LP + win/loss/draw counter + streaks) via unified service
  const outcome = isDraw ? 'draw' : isWinner ? 'win' : 'loss';
  await standingsService.recordBattleResult({
    entityType: 'robot',
    entityId: robot.id,
    mode: 'league_1v1',
    outcome,
    lpDelta: leaguePointsChange,
  });
  
  // Update BattleParticipant with prestige and fame
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: battle.id,
      robotId: robot.id,
    },
    data: {
      prestigeAwarded,
      fameAwarded,
    },
  });
  
  // Award prestige and credits via shared helpers
  await awardPrestigeToUser(robot.userId, prestigeAwarded);
  const reward = isWinner ? battle.winnerReward : battle.loserReward;
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(
    robot.userId,
    reward ?? 0,
    'battle_income',
    cycleNumber,
    'League 1v1 battle reward',
    robot.id,
  );
  
  return { prestigeAwarded, fameAwarded };
}

/**
 * Process a single scheduled battle
 */
export async function processBattle(scheduledMatch: ScheduledLeagueMatchData): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number; achievementUnlocks: UnlockedAchievement[] }> {
  // Detect bye match BEFORE DB lookup — bye robots are in-memory fabrications (id < 0)
  // and don't exist in the database (Spec #41).
  const isByeMatch = scheduledMatch.robot1Id < 0 || scheduledMatch.robot2Id < 0;
  if (isByeMatch) {
    return processByeBattle(scheduledMatch);
  }

  // Load both robots with their weapons
  // Spec #34: include refinements so prepareRobotForCombat can fold them
  // into the weapon's effective stats before the simulator reads them.
  const robot1 = await prisma.robot.findUnique({ 
    where: { id: scheduledMatch.robot1Id },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });
  const robot2 = await prisma.robot.findUnique({ 
    where: { id: scheduledMatch.robot2Id },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });
  
  if (!robot1 || !robot2) {
    throw new BattleError(
      BattleErrorCode.ROBOT_NOT_ELIGIBLE,
      `Robots not found for match ${scheduledMatch.id}`,
      404,
      { matchId: scheduledMatch.id, robot1Id: scheduledMatch.robot1Id, robot2Id: scheduledMatch.robot2Id }
    );
  }
  
  // Robots enter battles fully repaired (battle-ready state)
  // This is the intended game mechanic - players should repair before battles
  // Fetch tuning bonuses in a single batch query and prepare robots for combat
  const tuningMap = await getTuningBonusesBatch([robot1.id, robot2.id]);
  prepareRobotForCombat(robot1, tuningMap.get(robot1.id) ?? {});
  prepareRobotForCombat(robot2, tuningMap.get(robot2.id) ?? {});
  
  // Normal (non-bye) battle — simulate combat
  const result = simulateBattleWrapper(robot1, robot2);
  
  // Create battle record
  const battle = await createBattleRecord(scheduledMatch, robot1, robot2, result);
  result.battleId = battle.id;
  
  // Fetch both participants once (created by createBattleRecord) — reused throughout
  const participants = await prisma.battleParticipant.findMany({
    where: { battleId: battle.id },
  });
  const robot1Participant = participants.find(p => p.robotId === robot1.id)!;
  const robot2Participant = participants.find(p => p.robotId === robot2.id)!;
  
  if (!robot1Participant || !robot2Participant) {
    throw new BattleError(
      BattleErrorCode.INVALID_BATTLE_STATE,
      `BattleParticipant records not found for battle ${battle.id}`,
      500,
      { battleId: battle.id, robot1Id: robot1.id, robot2Id: robot2.id }
    );
  }
  
  // Update robot stats and award prestige/fame (pass pre-fetched participants)
  const stats1 = await updateRobotStats(robot1, battle, robot1Participant, robot2Participant, false);
  const stats2 = await updateRobotStats(robot2, battle, robot2Participant, robot1Participant, false);
  
  const totalPrestige = stats1.prestigeAwarded + stats2.prestigeAwarded;
  const totalFame = stats1.fameAwarded + stats2.fameAwarded;
  
  // Calculate and award streaming revenue (parallel — independent per robot)
  const [streamingRevenue1, streamingRevenue2] = await Promise.all([
    awardStreamingRevenueForParticipant(robot1.id, robot1.userId, battle.id, false),
    awardStreamingRevenueForParticipant(robot2.id, robot2.userId, battle.id, false),
  ]);
  
  if (streamingRevenue1) {
    logger.info(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
  }
  if (streamingRevenue2) {
    logger.info(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
  }
  
  // Determine results for each robot (participants already fetched above)
  const robot1IsWinner = result.winnerId === robot1.id;
  const robot2IsWinner = result.winnerId === robot2.id;
  
  // Log battle_complete events to audit log - ONE EVENT PER ROBOT (parallel — independent writes)
  // Non-blocking: audit failures must never crash a battle
  try {
    await Promise.all([
      logBattleAuditEvent(
        {
          robotId: robot1.id,
          userId: robot1.userId,
          isWinner: robot1IsWinner,
          isDraw: result.isDraw,
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
        { id: battle.id, battleType: battle.battleType, leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot1Participant.eloAfter - robot1Participant.eloBefore) },
        robot2.id,
        streamingRevenue1?.totalRevenue || 0,
        false,
      ),
      logBattleAuditEvent(
        {
          robotId: robot2.id,
          userId: robot2.userId,
          isWinner: robot2IsWinner,
          isDraw: result.isDraw,
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
        { id: battle.id, battleType: battle.battleType, leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot2Participant.eloAfter - robot2Participant.eloBefore) },
        robot1.id,
        streamingRevenue2?.totalRevenue || 0,
        false,
      ),
    ]);
  } catch (auditError) {
    logger.error(`[BattleOrchestrator] Audit log failed for battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }
  
  // Prestige/fame awards are already stored in BattleParticipant records
  // No need to update Battle table
  
  // Check and award achievements for both robots
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
        hasTuning: Object.values(tuningMap.get(robot1.id) ?? {}).some(v => v !== undefined && v > 0),
        hasMainWeapon: robot1.mainWeaponId !== null,
        battleType: 'league_1v1',
        battleDurationSeconds: result.durationSeconds,
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
        hasTuning: Object.values(tuningMap.get(robot2.id) ?? {}).some(v => v !== undefined && v > 0),
        hasMainWeapon: robot2.mainWeaponId !== null,
        battleType: 'league_1v1',
        battleDurationSeconds: result.durationSeconds,
      }),
    ]);
    const achievementUnlocks = [...unlocks1, ...unlocks2];

  // Update scheduled match status in unified table
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });
  
  // Consolidated battle completion log
  const winnerName = result.winnerId ? (result.winnerId === robot1.id ? robot1.name : robot2.name) : 'Draw';
  
  // Check for kills from BattleParticipant data (reuse variables from earlier)
  const robot1Killed = robot2Participant?.destroyed || false;
  const robot2Killed = robot1Participant?.destroyed || false;
  const killInfo = robot1Killed ? ` | Kill: ${robot1.name}` : (robot2Killed ? ` | Kill: ${robot2.name}` : '');
  
  logger.info(`[Battle] League: ${battle.leagueType} | ${robot1.name} (User ${robot1.userId}) vs ${robot2.name} (User ${robot2.userId}) | Winner: ${winnerName} | Rewards: ₡${battle.winnerReward?.toLocaleString() || 0} / ₡${battle.loserReward?.toLocaleString() || 0} | Prestige: +${totalPrestige} | Fame: +${totalFame}${killInfo}`);
  
  return {
    ...result,
    prestigeAwarded: totalPrestige,
    fameAwarded: totalFame,
    achievementUnlocks,
  };
}

/**
 * Execute scheduled battles
 * @param _scheduledFor - Optional date filter. If provided, only executes matches scheduled for this time or earlier.
 *                       If not provided (undefined), executes ALL scheduled matches regardless of their scheduled time.
 */
export async function executeScheduledBattles(_scheduledFor?: Date): Promise<BattleExecutionSummary> {
  logger.info('[BattleOrchestrator] Executing all scheduled league battles');
  
  // Read from unified scheduled_matches_v2 table (Spec #40)
  const unifiedMatches = await prisma.scheduledMatch.findMany({
    where: {
      matchType: 'league_1v1',
      status: 'scheduled',
    },
    include: { participants: true },
    orderBy: { createdAt: 'asc' },
  });
  
  // Map unified matches to the shape processBattle expects
  const scheduledMatches = unifiedMatches.map(m => {
    const p1 = m.participants.find(p => p.slot === 1);
    const p2 = m.participants.find(p => p.slot === 2);
    return {
      id: m.id,
      robot1Id: p1?.participantId ?? 0,
      robot2Id: p2?.participantId ?? 0,
      leagueType: m.leagueType ?? 'bronze',
      leagueInstanceId: m.leagueInstanceId ?? 'bronze_1',
      scheduledFor: m.scheduledFor,
      status: m.status,
      battleId: m.battleId,
      createdAt: m.createdAt,
      // Keep reference to unified match for status update
      _unifiedMatchId: m.id,
    };
  });
  
  logger.info(`[BattleOrchestrator] Found ${scheduledMatches.length} matches to execute`);
  
  const summary: BattleExecutionSummary = {
    totalBattles: scheduledMatches.length,
    successfulBattles: 0,
    failedBattles: 0,
    byeBattles: 0,
    errors: [],
    totalStreamingRevenue: 0,
    reputationSummary: {
      totalPrestigeAwarded: 0,
      totalFameAwarded: 0,
      prestigeByLeague: {},
      fameByLeague: {},
    },
  };
  
  // Process each battle
  for (const match of scheduledMatches) {
    try {
      const result = await processBattle(match);
      summary.successfulBattles++;
      
      if (result.isByeMatch) {
        summary.byeBattles++;
      }
      
      // Track reputation awards (league type already known from the scheduled match)
      if (summary.reputationSummary) {
        summary.reputationSummary.totalPrestigeAwarded += result.prestigeAwarded;
        summary.reputationSummary.totalFameAwarded += result.fameAwarded;
        
        if (result.prestigeAwarded > 0 || result.fameAwarded > 0) {
          const league = match.leagueType;
          summary.reputationSummary.prestigeByLeague[league] = 
            (summary.reputationSummary.prestigeByLeague[league] || 0) + result.prestigeAwarded;
          summary.reputationSummary.fameByLeague[league] = 
            (summary.reputationSummary.fameByLeague[league] || 0) + result.fameAwarded;
        }
      }
    } catch (error) {
      summary.failedBattles++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`Match ${match.id}: ${errorMsg}`);
      logger.error(`[BattleOrchestrator] Failed to process match ${match.id}:`, error);
    }
  }
  
  logger.info(`[BattleOrchestrator] Execution complete: ${summary.successfulBattles} successful, ${summary.failedBattles} failed, ${summary.byeBattles} bye-matches`);
  logger.info(`[BattleOrchestrator] Reputation: ${summary.reputationSummary?.totalPrestigeAwarded} prestige, ${summary.reputationSummary?.totalFameAwarded} fame awarded`);
  if (summary.totalStreamingRevenue && summary.totalStreamingRevenue > 0) {
    logger.info(`[BattleOrchestrator] Streaming Revenue: ₡${summary.totalStreamingRevenue.toLocaleString()} total earned`);
  }
  
  return summary;
}








