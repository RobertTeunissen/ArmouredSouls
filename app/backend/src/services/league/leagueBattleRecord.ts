/**
 * League 1v1 Battle Record and Robot Updates
 *
 * Writes the Battle, BattleParticipant and summary rows for a fought 1v1
 * league battle, and applies each robot's post-battle update: combat stats,
 * standings LP, credits, prestige and fame.
 *
 * @module services/league/leagueBattleRecord
 */

import { Robot, Battle } from '../../../generated/prisma';
import { encodeBattleLog } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import {
  getLeagueWinReward,
  getParticipationReward,
} from '../../utils/economyCalculations';
import {
  calculateELOChange,
} from '../../utils/battleMath';
import {
  updateRobotCombatStats,
  awardCreditsWithLedger,
  awardPrestigeToUser,
} from '../battle/battlePostCombat';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import standingsService from '../standings/standingsService';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';
import { writeBattleSummary } from '../battle/battleSummaryWriter';
import type { ScheduledLeagueMatchData, BattleResult } from './leagueBattleOrchestrator';

// League points
export const LEAGUE_POINTS_WIN = 3;
export const LEAGUE_POINTS_LOSS = -1;
export const LEAGUE_POINTS_DRAW = 1;

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
 * Create a Battle record in the database
 */
export async function createBattleRecord(
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
  
  
  // Rewards depend on the tier only: a win pays the same to every stable (#596
  // removed the prestige bonus, which paid leading stables up to 50% more).
  const baseWinRewardAmount = getLeagueWinReward(scheduledMatch.leagueType);
  const participationReward = getParticipationReward(scheduledMatch.leagueType);

  // NOTE: Repair costs are NOT calculated here anymore.
  // They are calculated by RepairService when repairs are actually triggered.
  // This ensures accurate costs based on current damage and facility levels.

  // Winner gets the tier win reward + participation; loser and draws get participation.
  let robot1Reward = participationReward;
  let robot2Reward = participationReward;

  if (!result.isDraw && !result.isByeMatch) {
    if (isRobot1Winner) robot1Reward = baseWinRewardAmount + participationReward;
    else robot2Reward = baseWinRewardAmount + participationReward;
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
  const winnerReward = isRobot1Winner ? robot1Reward : robot2Reward;
  const loserReward = isRobot1Winner ? robot2Reward : robot1Reward;
  
  // Add reward summary to battle log
  if (!result.isDraw && !result.isByeMatch) {
    const baseWinReward = baseWinRewardAmount;
    
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
      winnerId: result.winnerId,
      battleType: 'league_1v1',
      leagueType: scheduledMatch.leagueType,
      leagueInstanceId: scheduledMatch.leagueInstanceId, // From scheduled match (standings-derived)
      
      // Battle log with combat messages AND detailed combat events for admin debugging
      ...(await encodeBattleLog({
        events: battleLog,
        isByeMatch: result.isByeMatch,
        detailedCombatEvents: result.combatEvents || [], // Admin debugging: formula breakdowns, attribute usage
        // 2D arena spatial metadata
        arenaRadius: result.arenaRadius,
        startingPositions: result.startingPositions,
        endingPositions: result.endingPositions,
      })),
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

  await recordCombatBuilds(battle.id, 'league_1v1', [robot1, robot2]);

  // Write pre-computed battle summary (Spec #39 — permanent stats for overview tab)
  await writeBattleSummary(battle.id, {
    events: result.combatEvents,
    duration: result.durationSeconds,
    battleType: 'league_1v1',
    robotMaxHP: { [robot1.name]: robot1.maxHP, [robot2.name]: robot2.maxHP },
    robotNameToId: { [robot1.name]: robot1.id, [robot2.name]: robot2.id },
    robotNameToTeam: { [robot1.name]: 1, [robot2.name]: 2 },
    startingPositions: result.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: result.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: result.arenaRadius,
  }, '[league-orchestrator]');

  return battle;
}

/**
 * Update robot stats after battle and award prestige/fame.
 * Uses shared updateRobotCombatStats + awardCreditsToUser + awardPrestigeToUser.
 * Accepts pre-fetched participant data to avoid redundant DB queries.
 */
export async function updateRobotStats(
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
    combatMaxHP: robot.maxHP,
    newELO,
    isWinner,
    isDraw,
    damageDealt: participant.damageDealt,
    damageTakenByOpponent: opponentParticipant?.damageDealt || 0,
    // Single opponent, so the flag is already an exact count.
    opponentsDestroyed: opponentParticipant?.destroyed ? 1 : 0,
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
  
  // Award stable-level prestige and battle income through the shared services.
  const reward = isWinner ? battle.winnerReward : battle.loserReward;
  const cycleNumber = await getCurrentCycleNumber();
  await awardPrestigeToUser(robot.userId, prestigeAwarded, cycleNumber, {
    source: 'battle',
    mode: 'league_1v1',
    battleId: battle.id,
  });
  await awardCreditsWithLedger(
    robot.userId,
    reward ?? 0,
    'battle_income',
    cycleNumber,
    'League 1v1 battle reward',
    robot.id,
    { battleId: battle.id },
    {
      battleId: battle.id,
      mode: 'league_1v1',
      tier: battle.leagueType,
      outcome: isDraw ? 'draw' : isWinner ? 'win' : 'loss',
      participationFloor: battle.loserReward ?? 0,
      winComponent: isWinner ? Math.max(0, (battle.winnerReward ?? 0) - (battle.loserReward ?? 0)) : 0,
      teamSize: 1,
      isBye: isByeMatch,
    },
  );
  
  return { prestigeAwarded, fameAwarded };
}

