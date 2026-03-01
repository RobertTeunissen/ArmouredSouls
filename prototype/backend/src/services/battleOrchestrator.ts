import { Robot, ScheduledMatch, Battle } from '@prisma/client';
import prisma from '../lib/prisma';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { simulateBattle } from './combatSimulator';
import {
  getLeagueBaseReward,
  getParticipationReward,
  calculateBattleWinnings,
  getPrestigeMultiplier,
} from '../utils/economyCalculations';
import { eventLogger, EventType } from './eventLogger';
import { calculateStreamingRevenue, awardStreamingRevenue } from './streamingRevenueService';
import {
  ELO_K_FACTOR,
  calculateExpectedScore as sharedCalculateExpectedScore,
  calculateELOChange as sharedCalculateELOChange,
} from '../utils/battleMath';

// League points
const LEAGUE_POINTS_WIN = 3;
const LEAGUE_POINTS_LOSS = -1;
const LEAGUE_POINTS_DRAW = 1;

// Battle simulation constants
const _WINNER_DAMAGE_PERCENT = 0.15; // Winners lose 15% HP
const _LOSER_DAMAGE_PERCENT = 0.40; // Losers lose 40% HP
const BYE_BATTLE_DAMAGE_PERCENT = 0.08; // Bye battles: 8% HP loss
const _MIN_BATTLE_DURATION = 20; // Minimum battle duration in seconds
const _BATTLE_DURATION_VARIANCE = 25; // Random variance added to duration
const BYE_BATTLE_DURATION = 15; // Fixed duration for bye battles

// Bye-robot identifier
const BYE_ROBOT_NAME = 'Bye Robot';

/**
 * Get the current cycle number from metadata
 * Returns the CURRENT cycle (totalCycles + 1) since totalCycles represents COMPLETED cycles
 * Returns 1 if metadata doesn't exist (e.g., during tests or first cycle)
 */
export async function getCurrentCycleNumber(): Promise<number> {
  try {
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    // totalCycles = completed cycles, so current cycle = totalCycles + 1
    return (metadata?.totalCycles || 0) + 1;
  } catch (error) {
    // If cycleMetadata table doesn't exist or query fails, return 1 (first cycle)
    console.warn('[BattleOrchestrator] Could not fetch cycle number, defaulting to 1:', error);
    return 1;
  }
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  combatEvents?: any[]; // Detailed combat events for admin debugging
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
function calculatePrestigeForBattle(winnerRobot: Robot, isDraw: boolean, isByeMatch: boolean): number {
  if (isDraw || isByeMatch) return 0; // No prestige for draws or bye matches
  
  const prestigeByLeague: Record<string, number> = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };
  
  return prestigeByLeague[winnerRobot.currentLeague] || 0;
}

/**
 * Calculate fame award for a battle win
 */
function calculateFameForBattle(
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
  
  let baseFame = fameByLeague[winnerRobot.currentLeague] || 0;
  
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
 * Get fame tier name based on fame value
 */
function _getFameTier(fame: number): string {
  if (fame < 100) return "Unknown";
  if (fame < 500) return "Known";
  if (fame < 1000) return "Famous";
  if (fame < 2500) return "Renowned";
  if (fame < 5000) return "Legendary";
  return "Mythical";
}

/**
 * Calculate expected ELO score (delegates to shared battleMath)
 */
function _calculateExpectedScore(ratingA: number, ratingB: number): number {
  return sharedCalculateExpectedScore(ratingA, ratingB);
}

/**
 * Calculate ELO changes for both robots (delegates to shared battleMath)
 */
export function calculateELOChange(
  winnerELO: number,
  loserELO: number,
  isDraw: boolean = false
): { winnerChange: number; loserChange: number } {
  return sharedCalculateELOChange(winnerELO, loserELO, isDraw, ELO_K_FACTOR);
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
  };
}

/**
 * Simulate a bye-robot battle (player always wins easily)
 */
function simulateByeBattle(playerRobot: Robot, byeRobot: Robot): BattleResult {
  // Player wins with minimal damage (BYE_BATTLE_DAMAGE_PERCENT HP)
  const playerDamage = Math.floor(playerRobot.maxHP * BYE_BATTLE_DAMAGE_PERCENT);
  const playerFinalHP = Math.max(0, playerRobot.currentHP - playerDamage);
  
  // Bye-robot loses badly
  const byeRobotFinalHP = 0;
  const byeRobotDamage = byeRobot.currentHP;
  
  return {
    battleId: 0,
    winnerId: playerRobot.id,
    robot1FinalHP: playerFinalHP,
    robot2FinalHP: byeRobotFinalHP,
    robot1Damage: playerDamage,
    robot2Damage: byeRobotDamage,
    durationSeconds: BYE_BATTLE_DURATION,
    isDraw: false,
    isByeMatch: true,
  };
}

/**
 * Create a Battle record in the database
 */
async function createBattleRecord(
  scheduledMatch: ScheduledMatch,
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
  const leagueRewards = getLeagueBaseReward(scheduledMatch.leagueType);
  const participationReward = getParticipationReward(scheduledMatch.leagueType);
  
  // Get users for prestige multiplier
  const robot1User = await prisma.user.findUnique({ where: { id: robot1.userId } });
  const robot2User = await prisma.user.findUnique({ where: { id: robot2.userId } });
  
  // Query facility levels and robot count for repair cost calculation
  const robot1Facilities = await prisma.facility.findMany({
    where: { userId: robot1.userId, facilityType: { in: ['Repair Bay', 'Medical Bay'] } }
  });
  const robot2Facilities = await prisma.facility.findMany({
    where: { userId: robot2.userId, facilityType: { in: ['Repair Bay', 'Medical Bay'] } }
  });
  
  const _robot1RepairBayLevel = robot1Facilities.find(f => f.facilityType === 'Repair Bay')?.level || 0;
  const _robot1MedicalBayLevel = robot1Facilities.find(f => f.facilityType === 'Medical Bay')?.level || 0;
  const _robot2RepairBayLevel = robot2Facilities.find(f => f.facilityType === 'Repair Bay')?.level || 0;
  const _robot2MedicalBayLevel = robot2Facilities.find(f => f.facilityType === 'Medical Bay')?.level || 0;
  
  const _robot1ActiveRobotCount = await prisma.robot.count({
    where: { userId: robot1.userId, NOT: { name: 'Bye Robot' } }
  });
  const _robot2ActiveRobotCount = await prisma.robot.count({
    where: { userId: robot2.userId, NOT: { name: 'Bye Robot' } }
  });
  
  // Calculate repair costs using canonical function
  // NOTE: Repair costs are NOT calculated here anymore
  // They are calculated by RepairService when repairs are actually triggered
  // This ensures accurate costs based on current damage and facility levels
  
  // Winner gets midpoint of league range + participation reward, with prestige bonus
  // Loser gets only participation reward
  let robot1Reward = participationReward;
  let robot2Reward = participationReward;
  
  if (!result.isDraw && !result.isByeMatch) {
    if (isRobot1Winner && robot1User) {
      const baseWinReward = leagueRewards.midpoint;
      const winRewardWithPrestige = calculateBattleWinnings(baseWinReward, robot1User.prestige);
      robot1Reward = winRewardWithPrestige + participationReward;
    } else if (!isRobot1Winner && robot2User) {
      const baseWinReward = leagueRewards.midpoint;
      const winRewardWithPrestige = calculateBattleWinnings(baseWinReward, robot2User.prestige);
      robot2Reward = winRewardWithPrestige + participationReward;
    }
  } else if (result.isDraw) {
    // Draw: both get participation reward only (no win reward)
    robot1Reward = participationReward;
    robot2Reward = participationReward;
  }
  
  // Generate battle log with combat messages from REAL simulator events
  const battleLog = CombatMessageGenerator.generateBattleLog({
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
    battleType: 'league',
  });
  
  // Add financial reward details to battle log
  const winnerPrestige = isRobot1Winner ? robot1User?.prestige || 0 : robot2User?.prestige || 0;
  const winnerReward = isRobot1Winner ? robot1Reward : robot2Reward;
  const loserReward = isRobot1Winner ? robot2Reward : robot1Reward;
  const prestigeMultiplier = getPrestigeMultiplier(winnerPrestige);
  
  // Add reward summary to battle log
  if (!result.isDraw && !result.isByeMatch) {
    const baseWinReward = leagueRewards.midpoint;
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
      message: `      • League Base (${scheduledMatch.leagueType}): ₡${baseWinReward.toLocaleString()} (range: ₡${leagueRewards.min.toLocaleString()}-₡${leagueRewards.max.toLocaleString()})`,
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
      battleType: 'league', // Phase 1 only has league battles
      leagueType: scheduledMatch.leagueType,
      
      // Battle log with combat messages AND detailed combat events for admin debugging
      battleLog: {
        events: battleLog,
        isByeMatch: result.isByeMatch,
        detailedCombatEvents: result.combatEvents || [], // Admin debugging: formula breakdowns, attribute usage
      },
      durationSeconds: result.durationSeconds,
      
      // Economic data
      winnerReward: isRobot1Winner ? robot1Reward : robot2Reward,
      loserReward: isRobot1Winner ? robot2Reward : robot1Reward,
      
      // ELO tracking
      robot1ELOBefore,
      robot2ELOBefore,
      robot1ELOAfter,
      robot2ELOAfter,
      eloChange,
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
        credits: isRobot1Winner ? robot1Reward : robot2Reward,
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
        credits: isRobot1Winner ? robot2Reward : robot1Reward,
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
  
  return battle;
}

/**
 * Update robot stats after battle and award prestige/fame
 */
async function updateRobotStats(
  robot: Robot,
  battle: Battle,
  isRobot1: boolean,
  isByeMatch: boolean
): Promise<{ prestigeAwarded: number; fameAwarded: number }> {
  const isWinner = battle.winnerId === robot.id;
  const isDraw = battle.winnerId === null;
  
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
    throw new Error(`BattleParticipant not found for battle ${battle.id}, robot ${robot.id}`);
  }
  
  const finalHP = participant.finalHP;
  const newELO = participant.eloAfter;
  
  // Calculate league points change
  let leaguePointsChange = 0;
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
    prestigeAwarded = calculatePrestigeForBattle(robot, isDraw, isByeMatch);
    fameAwarded = calculateFameForBattle(robot, finalHP, isDraw, isByeMatch);
    
    // Award prestige to user
    if (prestigeAwarded > 0) {
      await prisma.user.update({
        where: { id: robot.userId },
        data: {
          prestige: { increment: prestigeAwarded },
        },
      });
    }
  }
  
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
  
  const opponentDestroyed = opponentParticipant?.destroyed || false;
  
  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentHP: finalHP,
      repairCost: 0, // Repair costs calculated by RepairService
      elo: newELO,
      leaguePoints: Math.max(0, robot.leaguePoints + leaguePointsChange), // Min 0
      totalBattles: robot.totalBattles + 1,
      wins: isWinner ? robot.wins + 1 : robot.wins,
      draws: isDraw ? robot.draws + 1 : robot.draws,
      losses: (!isWinner && !isDraw) ? robot.losses + 1 : robot.losses,
      kills: opponentDestroyed ? robot.kills + 1 : robot.kills, // Increment kills when opponent destroyed
      damageDealtLifetime: robot.damageDealtLifetime + participant.damageDealt,
      damageTakenLifetime: robot.damageTakenLifetime + (opponentParticipant?.damageDealt || 0),
      fame: isWinner ? { increment: fameAwarded } : undefined,
    },
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
  
  // Award credits to user based on battle outcome
  // Winner gets winnerReward, loser gets loserReward (both include participation)
  const reward = isWinner ? battle.winnerReward : battle.loserReward;
  
  if (reward !== null && reward > 0) {
    await prisma.user.update({
      where: { id: robot.userId },
      data: {
        currency: { increment: reward }
      },
    });
  }
  
  return { prestigeAwarded, fameAwarded };
}

/**
 * Process a single scheduled battle
 */
export async function processBattle(scheduledMatch: ScheduledMatch): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number }> {
  // Load both robots with their weapons
  const robot1 = await prisma.robot.findUnique({ 
    where: { id: scheduledMatch.robot1Id },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });
  const robot2 = await prisma.robot.findUnique({ 
    where: { id: scheduledMatch.robot2Id },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });
  
  if (!robot1 || !robot2) {
    throw new Error(`Robots not found for match ${scheduledMatch.id}`);
  }
  
  // Robots enter battles fully repaired (battle-ready state)
  // This is the intended game mechanic - players should repair before battles
  robot1.currentHP = robot1.maxHP;
  robot1.currentShield = robot1.maxShield;
  robot2.currentHP = robot2.maxHP;
  robot2.currentShield = robot2.maxShield;
  
  // Check if this is a bye-robot match
  const isByeMatch = robot1.name === BYE_ROBOT_NAME || robot2.name === BYE_ROBOT_NAME;
  
  // Simulate battle
  let result: BattleResult;
  if (isByeMatch) {
    const playerRobot = robot1.name === BYE_ROBOT_NAME ? robot2 : robot1;
    const byeRobot = robot1.name === BYE_ROBOT_NAME ? robot1 : robot2;
    result = simulateByeBattle(playerRobot, byeRobot);
    
    // Adjust result to match robot order
    if (robot1.name === BYE_ROBOT_NAME) {
      // Swap the results since bye-robot is robot1
      const temp = result.robot1FinalHP;
      result.robot1FinalHP = result.robot2FinalHP;
      result.robot2FinalHP = temp;
      const tempDamage = result.robot1Damage;
      result.robot1Damage = result.robot2Damage;
      result.robot2Damage = tempDamage;
    }
  } else {
    result = simulateBattleWrapper(robot1, robot2);
  }
  
  // Create battle record
  const battle = await createBattleRecord(scheduledMatch, robot1, robot2, result);
  result.battleId = battle.id;
  
  // Update robot stats and award prestige/fame
  const stats1 = await updateRobotStats(robot1, battle, true, isByeMatch);
  const stats2 = await updateRobotStats(robot2, battle, false, isByeMatch);
  
  const totalPrestige = stats1.prestigeAwarded + stats2.prestigeAwarded;
  const totalFame = stats1.fameAwarded + stats2.fameAwarded;
  
  // Calculate and award streaming revenue
  let streamingRevenue1 = null;
  let streamingRevenue2 = null;
  
  if (!isByeMatch) {
    streamingRevenue1 = await calculateStreamingRevenue(robot1.id, robot1.userId, false);
    streamingRevenue2 = await calculateStreamingRevenue(robot2.id, robot2.userId, false);
    
    const cycleNumber = await getCurrentCycleNumber();
    
    if (streamingRevenue1) {
      await awardStreamingRevenue(robot1.userId, streamingRevenue1, cycleNumber);
      console.log(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
    }
    if (streamingRevenue2) {
      await awardStreamingRevenue(robot2.userId, streamingRevenue2, cycleNumber);
      console.log(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
    }
  }
  
  // Update BattleParticipant records with prestige, fame, and streaming revenue
  await prisma.battleParticipant.update({
    where: {
      battleId_robotId: {
        battleId: battle.id,
        robotId: robot1.id,
      },
    },
    data: {
      prestigeAwarded: stats1.prestigeAwarded,
      fameAwarded: stats1.fameAwarded,
      streamingRevenue: streamingRevenue1?.totalRevenue || 0,
    },
  });
  
  await prisma.battleParticipant.update({
    where: {
      battleId_robotId: {
        battleId: battle.id,
        robotId: robot2.id,
      },
    },
    data: {
      prestigeAwarded: stats2.prestigeAwarded,
      fameAwarded: stats2.fameAwarded,
      streamingRevenue: streamingRevenue2?.totalRevenue || 0,
    },
  });
  
  // Get participant data for audit logging
  const robot1Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot1.id } },
  });
  const robot2Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot2.id } },
  });
  
  if (!robot1Participant || !robot2Participant) {
    throw new Error(`BattleParticipant records not found for battle ${battle.id}`);
  }
  
  // Log battle_complete events to audit log - ONE EVENT PER ROBOT
  const cycleNumber = await getCurrentCycleNumber();
  
  // Determine results for each robot
  const robot1IsWinner = result.winnerId === robot1.id;
  const robot2IsWinner = result.winnerId === robot2.id;
  const robot1Result = result.isDraw ? 'draw' : (robot1IsWinner ? 'win' : 'loss');
  const robot2Result = result.isDraw ? 'draw' : (robot2IsWinner ? 'win' : 'loss');
  
  // Event 1: Robot 1's perspective
  await eventLogger.logEvent(
    cycleNumber,
    EventType.BATTLE_COMPLETE,
    {
      // Battle outcome
      result: robot1Result,
      opponentId: robot2.id,
      isByeMatch: result.isByeMatch,
      
      // ELO changes
      eloBefore: robot1Participant.eloBefore,
      eloAfter: robot1Participant.eloAfter,
      eloChange: robot1IsWinner ? battle.eloChange : -battle.eloChange,
      
      // Combat stats
      damageDealt: robot1Participant.damageDealt,
      finalHP: robot1Participant.finalHP,
      yielded: robot1Participant.yielded,
      destroyed: robot1Participant.destroyed,
      
      // Rewards (credits attributed to user/stable)
      credits: robot1IsWinner ? battle.winnerReward : battle.loserReward,
      prestige: stats1.prestigeAwarded,
      fame: stats1.fameAwarded,
      streamingRevenue: streamingRevenue1?.totalRevenue || 0,
      
      // Battle metadata
      battleType: battle.battleType,
      leagueType: battle.leagueType,
      durationSeconds: battle.durationSeconds,
    },
    {
      userId: robot1.userId,
      robotId: robot1.id,
      battleId: battle.id,
    }
  );
  
  // Event 2: Robot 2's perspective
  await eventLogger.logEvent(
    cycleNumber,
    EventType.BATTLE_COMPLETE,
    {
      // Battle outcome
      result: robot2Result,
      opponentId: robot1.id,
      isByeMatch: result.isByeMatch,
      
      // ELO changes
      eloBefore: robot2Participant.eloBefore,
      eloAfter: robot2Participant.eloAfter,
      eloChange: robot2IsWinner ? battle.eloChange : -battle.eloChange,
      
      // Combat stats
      damageDealt: robot2Participant.damageDealt,
      finalHP: robot2Participant.finalHP,
      yielded: robot2Participant.yielded,
      destroyed: robot2Participant.destroyed,
      
      // Rewards (credits attributed to user/stable)
      credits: robot2IsWinner ? battle.winnerReward : battle.loserReward,
      prestige: stats2.prestigeAwarded,
      fame: stats2.fameAwarded,
      streamingRevenue: streamingRevenue2?.totalRevenue || 0,
      
      // Battle metadata
      battleType: battle.battleType,
      leagueType: battle.leagueType,
      durationSeconds: battle.durationSeconds,
    },
    {
      userId: robot2.userId,
      robotId: robot2.id,
      battleId: battle.id,
    }
  );
  
  // Prestige/fame awards are already stored in BattleParticipant records
  // No need to update Battle table
  
  // Update scheduled match
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });
  
  // Consolidated battle completion log
  const winnerName = result.winnerId ? (result.winnerId === robot1.id ? robot1.name : robot2.name) : 'Draw';
  const robot1User = await prisma.user.findUnique({ where: { id: robot1.userId }, select: { id: true } });
  const robot2User = await prisma.user.findUnique({ where: { id: robot2.userId }, select: { id: true } });
  
  // Check for kills from BattleParticipant data (reuse variables from earlier)
  const robot1Killed = robot2Participant?.destroyed || false;
  const robot2Killed = robot1Participant?.destroyed || false;
  const killInfo = robot1Killed ? ` | Kill: ${robot1.name}` : (robot2Killed ? ` | Kill: ${robot2.name}` : '');
  
  console.log(`[Battle] League: ${battle.leagueType} | ${robot1.name} (User ${robot1User?.id}) vs ${robot2.name} (User ${robot2User?.id}) | Winner: ${winnerName} | Rewards: ₡${battle.winnerReward?.toLocaleString() || 0} / ₡${battle.loserReward?.toLocaleString() || 0} | Prestige: +${totalPrestige} | Fame: +${totalFame}${killInfo}`);
  
  return {
    ...result,
    prestigeAwarded: totalPrestige,
    fameAwarded: totalFame,
  };
}

/**
 * Execute scheduled battles
 * @param scheduledFor - Optional date filter. If provided, only executes matches scheduled for this time or earlier.
 *                       If not provided (undefined), executes ALL scheduled matches regardless of their scheduled time.
 */
export async function executeScheduledBattles(scheduledFor?: Date): Promise<BattleExecutionSummary> {
  console.log('[BattleOrchestrator] Executing all scheduled league battles');
  
  // Execute all matches with status 'scheduled' — the cron job controls timing,
  // scheduledFor is informational only (shown to players)
  const scheduledMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
  
  console.log(`[BattleOrchestrator] Found ${scheduledMatches.length} matches to execute`);
  
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
      
      // Track streaming revenue from audit log
      if (!result.isByeMatch) {
        const battleCompleteEvent = await prisma.auditLog.findFirst({
          where: {
            eventType: 'battle_complete',
            payload: {
              path: ['battleId'],
              equals: result.battleId,
            },
          },
          orderBy: { id: 'desc' },
        });
        
        if (battleCompleteEvent) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = battleCompleteEvent.payload as any;
          const streamingRevenue1 = payload?.streamingRevenue1 || 0;
          const streamingRevenue2 = payload?.streamingRevenue2 || 0;
          summary.totalStreamingRevenue = (summary.totalStreamingRevenue || 0) + streamingRevenue1 + streamingRevenue2;
        }
      }
      
      // Track reputation awards
      if (summary.reputationSummary) {
        summary.reputationSummary.totalPrestigeAwarded += result.prestigeAwarded;
        summary.reputationSummary.totalFameAwarded += result.fameAwarded;
        
        // Track by league if there was a winner
        if (result.prestigeAwarded > 0 || result.fameAwarded > 0) {
          // Get winner's league
          const robot = await prisma.robot.findUnique({ 
            where: { id: result.winnerId || 0 },
            select: { currentLeague: true }
          });
          
          if (robot) {
            const league = robot.currentLeague;
            summary.reputationSummary.prestigeByLeague[league] = 
              (summary.reputationSummary.prestigeByLeague[league] || 0) + result.prestigeAwarded;
            summary.reputationSummary.fameByLeague[league] = 
              (summary.reputationSummary.fameByLeague[league] || 0) + result.fameAwarded;
          }
        }
      }
    } catch (error) {
      summary.failedBattles++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`Match ${match.id}: ${errorMsg}`);
      console.error(`[BattleOrchestrator] Failed to process match ${match.id}:`, error);
    }
  }
  
  console.log(`[BattleOrchestrator] Execution complete: ${summary.successfulBattles} successful, ${summary.failedBattles} failed, ${summary.byeBattles} bye-matches`);
  console.log(`[BattleOrchestrator] Reputation: ${summary.reputationSummary?.totalPrestigeAwarded} prestige, ${summary.reputationSummary?.totalFameAwarded} fame awarded`);
  if (summary.totalStreamingRevenue && summary.totalStreamingRevenue > 0) {
    console.log(`[BattleOrchestrator] Streaming Revenue: ₡${summary.totalStreamingRevenue.toLocaleString()} total earned`);
  }
  
  return summary;
}
