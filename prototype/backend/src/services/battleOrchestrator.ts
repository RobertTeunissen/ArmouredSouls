import { PrismaClient, Robot, ScheduledMatch, Battle } from '@prisma/client';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { simulateBattle } from './combatSimulator';

const prisma = new PrismaClient();

// ELO calculation constant
const ELO_K_FACTOR = 32;

// League points
const LEAGUE_POINTS_WIN = 3;
const LEAGUE_POINTS_LOSS = -1;
const LEAGUE_POINTS_DRAW = 1;

// Reward calculations (in credits)
const BASE_REWARD_WIN = 1000;
const BASE_REWARD_LOSS = 300;
const BASE_REWARD_DRAW = 500;

// Battle simulation constants
const WINNER_DAMAGE_PERCENT = 0.15; // Winners lose 15% HP
const LOSER_DAMAGE_PERCENT = 0.40; // Losers lose 40% HP
const BYE_BATTLE_DAMAGE_PERCENT = 0.08; // Bye battles: 8% HP loss
const MIN_BATTLE_DURATION = 20; // Minimum battle duration in seconds
const BATTLE_DURATION_VARIANCE = 25; // Random variance added to duration
const BYE_BATTLE_DURATION = 15; // Fixed duration for bye battles

// Economic constants
const REPAIR_COST_PER_HP = 50; // Cost to repair 1 HP

// Bye-robot identifier
const BYE_ROBOT_NAME = 'Bye Robot';

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
  combatEvents?: any[]; // Detailed combat events for admin debugging
}

export interface BattleExecutionSummary {
  totalBattles: number;
  successfulBattles: number;
  failedBattles: number;
  byeBattles: number;
  errors: string[];
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
function getFameTier(fame: number): string {
  if (fame < 100) return "Unknown";
  if (fame < 500) return "Known";
  if (fame < 1000) return "Famous";
  if (fame < 2500) return "Renowned";
  if (fame < 5000) return "Legendary";
  return "Mythical";
}

/**
 * Calculate expected ELO score
 */
function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate ELO changes for both robots
 */
export function calculateELOChange(
  winnerELO: number,
  loserELO: number,
  isDraw: boolean = false
): { winnerChange: number; loserChange: number } {
  const expectedWinner = calculateExpectedScore(winnerELO, loserELO);
  const expectedLoser = calculateExpectedScore(loserELO, winnerELO);

  if (isDraw) {
    // Draw: both get 0.5 actual score
    const winnerChange = Math.round(ELO_K_FACTOR * (0.5 - expectedWinner));
    const loserChange = Math.round(ELO_K_FACTOR * (0.5 - expectedLoser));
    return { winnerChange, loserChange };
  } else {
    // Win/Loss: winner gets 1, loser gets 0
    const winnerChange = Math.round(ELO_K_FACTOR * (1 - expectedWinner));
    const loserChange = Math.round(ELO_K_FACTOR * (0 - expectedLoser));
    return { winnerChange, loserChange };
  }
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
  
  // Calculate rewards
  const robot1Reward = isRobot1Winner ? BASE_REWARD_WIN : BASE_REWARD_LOSS;
  const robot2Reward = isRobot1Winner ? BASE_REWARD_LOSS : BASE_REWARD_WIN;
  
  // Generate battle log with combat messages
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
    winnerMaxHP: 10, // Simplified
    loserFinalHP: isRobot1Winner ? result.robot2FinalHP : result.robot1FinalHP,
    robot1DamageDealt: result.robot2Damage,
    robot2DamageDealt: result.robot1Damage,
    leagueType: scheduledMatch.leagueType,
    durationSeconds: result.durationSeconds,
  });
  
  // Create battle record
  const battle = await prisma.battle.create({
    data: {
      userId: robot1.userId, // Primary user (could be either)
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
      robot1RepairCost: Math.floor(result.robot1Damage * REPAIR_COST_PER_HP),
      robot2RepairCost: Math.floor(result.robot2Damage * REPAIR_COST_PER_HP),
      
      // Final state
      robot1FinalHP: result.robot1FinalHP,
      robot2FinalHP: result.robot2FinalHP,
      robot1FinalShield: 0, // Simplified: shields depleted in battle
      robot2FinalShield: 0,
      robot1Yielded: false,
      robot2Yielded: false,
      robot1Destroyed: result.robot1FinalHP === 0,
      robot2Destroyed: result.robot2FinalHP === 0,
      
      // Damage tracking
      robot1DamageDealt: result.robot2Damage,
      robot2DamageDealt: result.robot1Damage,
      
      // ELO tracking
      robot1ELOBefore,
      robot2ELOBefore,
      robot1ELOAfter,
      robot2ELOAfter,
      eloChange,
    },
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
  
  const finalHP = isRobot1 ? battle.robot1FinalHP : battle.robot2FinalHP;
  const newELO = isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
  
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
          totalWins: { increment: 1 },
        },
      });
      console.log(`[Battle] Prestige: +${prestigeAwarded} → user ${robot.userId} (${robot.currentLeague} league win)`);
    }
  }
  
  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentHP: finalHP,
      elo: newELO,
      leaguePoints: Math.max(0, robot.leaguePoints + leaguePointsChange), // Min 0
      totalBattles: robot.totalBattles + 1,
      wins: isWinner ? robot.wins + 1 : robot.wins,
      draws: isDraw ? robot.draws + 1 : robot.draws,
      losses: (!isWinner && !isDraw) ? robot.losses + 1 : robot.losses,
      damageDealtLifetime: robot.damageDealtLifetime + (isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt),
      damageTakenLifetime: robot.damageTakenLifetime + (isRobot1 ? battle.robot2DamageDealt : battle.robot1DamageDealt),
      fame: isWinner ? { increment: fameAwarded } : undefined,
    },
  });
  
  if (isWinner && fameAwarded > 0) {
    const fameTier = getFameTier(robot.fame + fameAwarded);
    const hpPercent = (finalHP / robot.maxHP * 100).toFixed(0);
    console.log(`[Battle] Fame: +${fameAwarded} → ${robot.name} (${hpPercent}% HP remaining, tier: ${fameTier})`);
  }
  
  // Award credits to user
  const reward = isRobot1 
    ? (isWinner ? battle.winnerReward : battle.loserReward)
    : (isWinner ? battle.winnerReward : battle.loserReward);
  
  if (reward) {
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
  // Load both robots
  const robot1 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot1Id } });
  const robot2 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot2Id } });
  
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
  
  // Update scheduled match
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });
  
  console.log(`[Battle] Completed: ${robot1.name} vs ${robot2.name} (Winner: ${result.winnerId ? (result.winnerId === robot1.id ? robot1.name : robot2.name) : 'Draw'})`);
  
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
  // If no specific time provided, execute all scheduled matches regardless of scheduledFor time
  // If a specific time is provided, only execute matches scheduled for that time or earlier
  const useTimeFilter = scheduledFor !== undefined;
  const targetTime = scheduledFor || new Date();
  
  console.log(`[BattleOrchestrator] Executing battles${useTimeFilter ? ` scheduled for: ${targetTime.toISOString()}` : ' (all scheduled matches)'}`);
  
  // Build query to get scheduled matches
  // Use conditional spreading to only add scheduledFor filter when a specific time is provided
  const scheduledMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      // Only filter by scheduledFor if a specific time was provided
      ...(useTimeFilter && {
        scheduledFor: {
          lte: targetTime,
        },
      }),
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
  
  return summary;
}
