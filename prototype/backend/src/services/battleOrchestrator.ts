import { PrismaClient, Robot, ScheduledMatch, Battle } from '@prisma/client';

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
}

export interface BattleExecutionSummary {
  totalBattles: number;
  successfulBattles: number;
  failedBattles: number;
  byeBattles: number;
  errors: string[];
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
 * Simulate a simple battle between two robots
 * This is a simplified deterministic simulation for Phase 1
 */
function simulateBattle(robot1: Robot, robot2: Robot): BattleResult {
  // Simple simulation based on ELO and attributes
  const eloDiff = robot1.elo - robot2.elo;
  const combatPowerDiff = Number(robot1.combatPower) - Number(robot2.combatPower);
  
  // Calculate win probability (higher ELO = better chance)
  const robot1Advantage = eloDiff / 400 + combatPowerDiff;
  const robot1WinChance = 0.5 + (robot1Advantage * 0.1); // Clamp between reasonable values
  
  // Determine winner (deterministic based on stats)
  const robot1Wins = robot1WinChance > 0.5;
  const winnerId = robot1Wins ? robot1.id : robot2.id;
  
  // Calculate damage dealt (loser takes more damage)
  const baseDamage = 30; // Base damage percentage
  const robot1DamageTaken = robot1Wins ? Math.floor(robot1.maxHP * 0.15) : Math.floor(robot1.maxHP * 0.40);
  const robot2DamageTaken = robot1Wins ? Math.floor(robot2.maxHP * 0.40) : Math.floor(robot2.maxHP * 0.15);
  
  const robot1FinalHP = Math.max(0, robot1.currentHP - robot1DamageTaken);
  const robot2FinalHP = Math.max(0, robot2.currentHP - robot2DamageTaken);
  
  // Battle duration (random between 20-45 seconds)
  const durationSeconds = 20 + Math.floor(Math.random() * 25);
  
  return {
    battleId: 0, // Will be set after creating battle record
    winnerId,
    robot1FinalHP,
    robot2FinalHP,
    robot1Damage: robot1DamageTaken,
    robot2Damage: robot2DamageTaken,
    durationSeconds,
    isDraw: false,
    isByeMatch: false,
  };
}

/**
 * Simulate a bye-robot battle (player always wins easily)
 */
function simulateByeBattle(playerRobot: Robot, byeRobot: Robot): BattleResult {
  // Player wins with minimal damage (5-10% HP)
  const playerDamage = Math.floor(playerRobot.maxHP * 0.08); // 8% damage
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
    durationSeconds: 15, // Quick battle
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
  
  // Create battle record
  const battle = await prisma.battle.create({
    data: {
      userId: robot1.userId, // Primary user (could be either)
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      winnerId: result.winnerId,
      battleType: 'league', // Phase 1 only has league battles
      leagueType: scheduledMatch.leagueType,
      
      // Battle log (simplified for Phase 1)
      battleLog: {
        events: [
          { time: 0, action: 'Battle started' },
          { time: result.durationSeconds, action: 'Battle ended' }
        ],
        isByeMatch: result.isByeMatch
      },
      durationSeconds: result.durationSeconds,
      
      // Economic data
      winnerReward: isRobot1Winner ? robot1Reward : robot2Reward,
      loserReward: isRobot1Winner ? robot2Reward : robot1Reward,
      robot1RepairCost: Math.floor(result.robot1Damage * 50), // 50 credits per HP
      robot2RepairCost: Math.floor(result.robot2Damage * 50),
      
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
 * Update robot stats after battle
 */
async function updateRobotStats(
  robot: Robot,
  battle: Battle,
  isRobot1: boolean
): Promise<void> {
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
  
  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentHP: finalHP,
      elo: newELO,
      leaguePoints: Math.max(0, robot.leaguePoints + leaguePointsChange), // Min 0
      totalBattles: robot.totalBattles + 1,
      wins: isWinner ? robot.wins + 1 : robot.wins,
      losses: (!isWinner && !isDraw) ? robot.losses + 1 : robot.losses,
      damageDealtLifetime: robot.damageDealtLifetime + (isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt),
      damageTakenLifetime: robot.damageTakenLifetime + (isRobot1 ? battle.robot2DamageDealt : battle.robot1DamageDealt),
    },
  });
  
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
}

/**
 * Process a single scheduled battle
 */
export async function processBattle(scheduledMatch: ScheduledMatch): Promise<BattleResult> {
  // Load both robots
  const robot1 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot1Id } });
  const robot2 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot2Id } });
  
  if (!robot1 || !robot2) {
    throw new Error(`Robots not found for match ${scheduledMatch.id}`);
  }
  
  // Check if this is a bye-robot match
  const isByeMatch = robot1.name === 'Bye Robot' || robot2.name === 'Bye Robot';
  
  // Simulate battle
  let result: BattleResult;
  if (isByeMatch) {
    const playerRobot = robot1.name === 'Bye Robot' ? robot2 : robot1;
    const byeRobot = robot1.name === 'Bye Robot' ? robot1 : robot2;
    result = simulateByeBattle(playerRobot, byeRobot);
    
    // Adjust result to match robot order
    if (robot1.name === 'Bye Robot') {
      // Swap the results since bye-robot is robot1
      const temp = result.robot1FinalHP;
      result.robot1FinalHP = result.robot2FinalHP;
      result.robot2FinalHP = temp;
      const tempDamage = result.robot1Damage;
      result.robot1Damage = result.robot2Damage;
      result.robot2Damage = tempDamage;
    }
  } else {
    result = simulateBattle(robot1, robot2);
  }
  
  // Create battle record
  const battle = await createBattleRecord(scheduledMatch, robot1, robot2, result);
  result.battleId = battle.id;
  
  // Update robot stats
  await updateRobotStats(robot1, battle, true);
  await updateRobotStats(robot2, battle, false);
  
  // Update scheduled match
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });
  
  console.log(`[Battle] Completed: ${robot1.name} vs ${robot2.name} (Winner: ${result.winnerId ? (result.winnerId === robot1.id ? robot1.name : robot2.name) : 'Draw'})`);
  
  return result;
}

/**
 * Execute all scheduled battles for a specific time
 */
export async function executeScheduledBattles(scheduledFor?: Date): Promise<BattleExecutionSummary> {
  const targetTime = scheduledFor || new Date();
  
  console.log(`[BattleOrchestrator] Executing battles scheduled for: ${targetTime.toISOString()}`);
  
  // Get all scheduled matches for this time (or overdue)
  const scheduledMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      scheduledFor: {
        lte: targetTime,
      },
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
  };
  
  // Process each battle
  for (const match of scheduledMatches) {
    try {
      const result = await processBattle(match);
      summary.successfulBattles++;
      
      if (result.isByeMatch) {
        summary.byeBattles++;
      }
    } catch (error) {
      summary.failedBattles++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      summary.errors.push(`Match ${match.id}: ${errorMsg}`);
      console.error(`[BattleOrchestrator] Failed to process match ${match.id}:`, error);
    }
  }
  
  console.log(`[BattleOrchestrator] Execution complete: ${summary.successfulBattles} successful, ${summary.failedBattles} failed, ${summary.byeBattles} bye-matches`);
  
  return summary;
}
