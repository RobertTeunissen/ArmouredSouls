/**
 * Tournament Battle Orchestrator
 * Handles tournament-specific battle execution and rewards
 * 
 * IMPORTANT: Tournament bye matches do NOT create battles or awards.
 * League bye matches (against "Bye Robot") are handled in battleOrchestrator.ts
 * and DO create battles with participation rewards.
 */

import { Robot, TournamentMatch, Battle } from '@prisma/client';
import prisma from '../lib/prisma';
import { simulateBattle } from './combatSimulator';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { calculateELOChange, getCurrentCycleNumber } from './battleOrchestrator';
import {
  calculateTournamentBattleRewards,
  getTournamentRewardBreakdown,
} from '../utils/tournamentRewards';
import { calculateStreamingRevenue, awardStreamingRevenue } from './streamingRevenueService';
import { EventLogger, EventType } from './eventLogger';

// Economic constants
const REPAIR_COST_PER_HP = 50; // Cost to repair 1 HP

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
}

/**
 * Process a tournament match battle
 * 
 * Note: Tournament bye matches should NOT call this function.
 * Tournament byes are auto-completed at tournament creation (no battle, no rewards).
 * This is different from league bye matches which DO fight the "Bye Robot".
 */
export async function processTournamentBattle(
  tournamentMatch: TournamentMatch
): Promise<TournamentBattleResult> {
  if (!tournamentMatch.robot1Id || !tournamentMatch.robot2Id) {
    throw new Error(`Tournament match ${tournamentMatch.id} missing robots`);
  }

  if (tournamentMatch.isByeMatch) {
    throw new Error(`Bye match ${tournamentMatch.id} should not be processed as a battle`);
  }

  // Load both robots with weapons
  const robot1 = await prisma.robot.findUnique({
    where: { id: tournamentMatch.robot1Id },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  const robot2 = await prisma.robot.findUnique({
    where: { id: tournamentMatch.robot2Id },
    include: {
      mainWeapon: { include: { weapon: true } },
      offhandWeapon: { include: { weapon: true } },
    },
  });

  if (!robot1 || !robot2) {
    throw new Error(`Robots not found for tournament match ${tournamentMatch.id}`);
  }

  // Robots enter battles fully repaired
  robot1.currentHP = robot1.maxHP;
  robot1.currentShield = robot1.maxShield;
  robot2.currentHP = robot2.maxHP;
  robot2.currentShield = robot2.maxShield;

  // Simulate battle with tournament mode (resolves draws with HP tiebreaker)
  const combatResult = simulateBattle(robot1, robot2, true);

  // Get tournament for round information and participant count
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentMatch.tournamentId },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentMatch.tournamentId} not found`);
  }

  // Count robots remaining in current round (including bye robots)
  const currentRoundMatches = await prisma.tournamentMatch.findMany({
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
  const cycleNumber = await getCurrentCycleNumber();
  
  const streamingRevenue1 = await calculateStreamingRevenue(robot1.id, robot1.userId, false);
  const streamingRevenue2 = await calculateStreamingRevenue(robot2.id, robot2.userId, false);
  
  if (streamingRevenue1) {
    await awardStreamingRevenue(robot1.userId, streamingRevenue1, cycleNumber);
    console.log(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }
  if (streamingRevenue2) {
    await awardStreamingRevenue(robot2.userId, streamingRevenue2, cycleNumber);
    console.log(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }

  // Update BattleParticipant records with streaming revenue
  await prisma.battleParticipant.update({
    where: {
      battleId_robotId: {
        battleId: battle.id,
        robotId: robot1.id,
      },
    },
    data: {
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
      streamingRevenue: streamingRevenue2?.totalRevenue || 0,
    },
  });

  // Log battle_complete events to audit log - ONE EVENT PER ROBOT (new format)
  const eventLogger = new EventLogger();
  
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
  
  // Determine results for each robot
  const robot1IsWinner = battle.winnerId === robot1.id;
  const robot2IsWinner = battle.winnerId === robot2.id;
  const isDraw = battle.winnerId === null;
  const robot1Result = isDraw ? 'draw' : (robot1IsWinner ? 'win' : 'loss');
  const robot2Result = isDraw ? 'draw' : (robot2IsWinner ? 'win' : 'loss');
  
  // Event 1: Robot 1's perspective
  await eventLogger.logEvent(
    cycleNumber,
    EventType.BATTLE_COMPLETE,
    {
      // Battle outcome
      result: robot1Result,
      opponentId: robot2.id,
      isByeMatch: false,
      
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
      battleType: 'tournament',
      leagueType: 'tournament',
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
      isByeMatch: false,
      
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
      battleType: 'tournament',
      leagueType: 'tournament',
      durationSeconds: battle.durationSeconds,
    },
    {
      userId: robot2.userId,
      robotId: robot2.id,
      battleId: battle.id,
    }
  );

  // Update tournament match with result
  await prisma.tournamentMatch.update({
    where: { id: tournamentMatch.id },
    data: {
      winnerId: battle.winnerId,
      battleId: battle.id,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Get user IDs for logging
  const robot1User = await prisma.user.findUnique({ where: { id: robot1.userId }, select: { id: true } });
  const robot2User = await prisma.user.findUnique({ where: { id: robot2.userId }, select: { id: true } });
  
  // Check for kills from BattleParticipant data
  const robot1Killed = robot2Participant.destroyed;
  const robot2Killed = robot1Participant.destroyed;
  const killInfo = robot1Killed ? ` | Kill: ${robot1.name}` : (robot2Killed ? ` | Kill: ${robot2.name}` : '');
  
  const totalPrestige = stats1.prestigeAwarded + stats2.prestigeAwarded;
  const totalFame = stats1.fameAwarded + stats2.fameAwarded;
  
  console.log(
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
  };
}

/**
 * Create a Battle record for a tournament battle
 */
async function createTournamentBattleRecord(
  tournamentMatch: TournamentMatch,
  robot1: Robot,
  robot2: Robot,
  combatResult: any,
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
  const battleLog = CombatMessageGenerator.generateBattleLog({
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
    leagueType: robot1.currentLeague,
    durationSeconds: combatResult.durationSeconds,
    // Pass real simulator events + context for narrative conversion
    simulatorEvents: combatResult.events,
    robot1Stance: robot1.stance,
    robot2Stance: robot2.stance,
    robot1MaxHP: robot1.maxHP,
    robot2MaxHP: robot2.maxHP,
    battleType: 'tournament',
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
      battleType: 'tournament',
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
      },
      durationSeconds: combatResult.durationSeconds,

      // Economic data
      winnerReward: rewards.winnerReward,
      loserReward: rewards.loserReward,

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

  return battle;
}

/**
 * Update robot stats after tournament battle
 */
async function updateRobotStatsForTournament(
  robot: Robot,
  battle: Battle,
  isRobot1: boolean,
  round: number,
  maxRounds: number
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
    throw new Error(`BattleParticipant not found for battle ${battle.id}, robot ${robot.id}`);
  }
  
  const finalHP = participant.finalHP;
  const newELO = participant.eloAfter;
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
  
  const opponentDestroyed = opponentParticipant?.destroyed || false;

  // Update robot
  await prisma.robot.update({
    where: { id: robot.id },
    data: {
      currentHP: finalHP,
      elo: newELO,
      // League points NOT affected by tournament battles
      totalBattles: robot.totalBattles + 1,
      wins: isWinner ? robot.wins + 1 : robot.wins,
      losses: !isWinner ? robot.losses + 1 : robot.losses,
      kills: opponentDestroyed ? robot.kills + 1 : robot.kills,
      damageDealtLifetime:
        robot.damageDealtLifetime + participant.damageDealt,
      damageTakenLifetime:
        robot.damageTakenLifetime + (opponentParticipant?.damageDealt || 0),
      fame: isWinner ? { increment: fameAwarded } : undefined,
    },
  });

  // Award prestige to user (if winner)
  if (isWinner && prestigeAwarded > 0) {
    await prisma.user.update({
      where: { id: robot.userId },
      data: {
        prestige: { increment: prestigeAwarded },
      },
    });
  }

  // Award credits
  const reward = isWinner ? battle.winnerReward : battle.loserReward;

  if (reward && reward > 0) {
    await prisma.user.update({
      where: { id: robot.userId },
      data: {
        currency: { increment: reward },
      },
    });
  }

  return { prestigeAwarded, fameAwarded };
}
