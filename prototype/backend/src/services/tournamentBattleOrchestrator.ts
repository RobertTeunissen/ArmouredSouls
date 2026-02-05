/**
 * Tournament Battle Orchestrator
 * Handles tournament-specific battle execution and rewards
 * 
 * IMPORTANT: Tournament bye matches do NOT create battles or awards.
 * League bye matches (against "Bye Robot") are handled in battleOrchestrator.ts
 * and DO create battles with participation rewards.
 */

import { PrismaClient, Robot, TournamentMatch, Battle } from '@prisma/client';
import { simulateBattle } from './combatSimulator';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { calculateELOChange } from './battleOrchestrator';
import {
  calculateTournamentBattleRewards,
  getTournamentRewardBreakdown,
} from '../utils/tournamentRewards';

const prisma = new PrismaClient();

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

  // Simulate battle
  const combatResult = simulateBattle(robot1, robot2);

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

  console.log(
    `[Tournament] Battle completed: ${robot1.name} vs ${robot2.name} (Winner: ${battle.winnerId === robot1.id ? robot1.name : robot2.name}) [Round ${tournament.currentRound}]`
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

  // Generate battle log
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
      userId: robot1.userId,
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      winnerId: combatResult.winnerId,
      battleType: 'tournament',
      leagueType: robot1.currentLeague,
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
      winnerReward: isRobot1Winner ? rewards.winnerReward : rewards.loserReward,
      loserReward: isRobot1Winner ? rewards.loserReward : rewards.winnerReward,
      robot1RepairCost: Math.floor(combatResult.robot1Damage * REPAIR_COST_PER_HP),
      robot2RepairCost: Math.floor(combatResult.robot2Damage * REPAIR_COST_PER_HP),

      // Rewards tracking
      robot1PrestigeAwarded: isRobot1Winner ? rewards.winnerPrestige : rewards.loserPrestige,
      robot2PrestigeAwarded: isRobot1Winner ? rewards.loserPrestige : rewards.winnerPrestige,
      robot1FameAwarded: isRobot1Winner ? rewards.winnerFame : rewards.loserFame,
      robot2FameAwarded: isRobot1Winner ? rewards.loserFame : rewards.winnerFame,

      // Final state
      robot1FinalHP: combatResult.robot1FinalHP,
      robot2FinalHP: combatResult.robot2FinalHP,
      robot1FinalShield: 0,
      robot2FinalShield: 0,
      robot1Yielded: false,
      robot2Yielded: false,
      robot1Destroyed: combatResult.robot1FinalHP === 0,
      robot2Destroyed: combatResult.robot2FinalHP === 0,

      // Damage tracking
      robot1DamageDealt: combatResult.robot2Damage,
      robot2DamageDealt: combatResult.robot1Damage,

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
  const finalHP = isRobot1 ? battle.robot1FinalHP : battle.robot2FinalHP;
  const newELO = isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
  const prestigeAwarded = isRobot1 ? battle.robot1PrestigeAwarded : battle.robot2PrestigeAwarded;
  const fameAwarded = isRobot1 ? battle.robot1FameAwarded : battle.robot2FameAwarded;

  // Check if opponent was destroyed
  const opponentDestroyed = isRobot1 ? battle.robot2Destroyed : battle.robot1Destroyed;

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
        robot.damageDealtLifetime +
        (isRobot1 ? battle.robot1DamageDealt : battle.robot2DamageDealt),
      damageTakenLifetime:
        robot.damageTakenLifetime +
        (isRobot1 ? battle.robot2DamageDealt : battle.robot1DamageDealt),
      fame: isWinner ? { increment: fameAwarded } : undefined,
    },
  });

  // Award prestige to user (if winner)
  if (isWinner && prestigeAwarded > 0) {
    await prisma.user.update({
      where: { id: robot.userId },
      data: {
        prestige: { increment: prestigeAwarded },
        totalWins: { increment: 1 },
      },
    });
    console.log(
      `[Tournament] Prestige: +${prestigeAwarded} → user ${robot.userId} (Round ${round}, ${robot.currentLeague} league)`
    );
  }

  // Award credits
  const reward = isRobot1
    ? battle.winnerId === battle.robot1Id
      ? battle.winnerReward
      : battle.loserReward
    : battle.winnerId === battle.robot2Id
      ? battle.winnerReward
      : battle.loserReward;

  if (reward && reward > 0) {
    await prisma.user.update({
      where: { id: robot.userId },
      data: {
        currency: { increment: reward },
      },
    });
    console.log(
      `[Tournament] Credits: +₡${reward.toLocaleString()} → user ${robot.userId} (${isWinner ? 'winner' : 'loser'})`
    );
  }

  if (isWinner && fameAwarded > 0) {
    const hpPercent = ((finalHP / robot.maxHP) * 100).toFixed(0);
    console.log(
      `[Tournament] Fame: +${fameAwarded} → ${robot.name} (${hpPercent}% HP remaining, Round ${round})`
    );
  }

  if (opponentDestroyed) {
    console.log(`[Tournament] Kill: ${robot.name} destroyed opponent (total kills: ${robot.kills + 1})`);
  }

  return { prestigeAwarded, fameAwarded };
}
