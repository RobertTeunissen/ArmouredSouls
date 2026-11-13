/**
 * Solo Tournament Battle Record and Robot Updates
 *
 * Writes the Battle, BattleParticipant and summary rows for a fought 1v1
 * tournament battle, updates each robot's combat stats and prestige, and pays
 * the persisted participant reward exactly once.
 *
 * @module services/tournament/tournamentBattleRecord
 */

import { Robot, ScheduledTournamentMatch, Battle } from '../../../generated/prisma';
import { encodeBattleLog } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import { CombatResult } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { writeBattleSummary } from '../battle/battleSummaryWriter';
import { calculateELOChange } from '../../utils/battleMath';
import {
  calculateTournamentBattleRewards,
  getTournamentRewardBreakdown,
} from '../../utils/tournamentRewards';
import {
  updateRobotCombatStats,
  awardCreditsWithLedger,
  awardPrestigeToUser,
} from '../battle/battlePostCombat';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';

/**
 * Create a Battle record for a tournament battle
 */
export async function createTournamentBattleRecord(
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
      winnerId: combatResult.winnerId,
      battleType: 'tournament_1v1',
      leagueType: 'tournament', // Tournament battles use special league type
      tournamentId: tournamentMatch.tournamentId,
      tournamentRound: round,

      // Battle log
      ...(await encodeBattleLog({
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
      })),
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

  await recordCombatBuilds(battle.id, 'tournament_1v1', [robot1, robot2]);

  // Write pre-computed battle summary (Spec #39)
  await writeBattleSummary(battle.id, {
    events: combatResult.events,
    duration: combatResult.durationSeconds,
    battleType: 'tournament_1v1',
    robotMaxHP: { [robot1.name]: robot1.maxHP, [robot2.name]: robot2.maxHP },
    robotNameToId: { [robot1.name]: robot1.id, [robot2.name]: robot2.id },
    robotNameToTeam: { [robot1.name]: 1, [robot2.name]: 2 },
    startingPositions: combatResult.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: combatResult.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: combatResult.arenaRadius,
  }, '[tournament-orchestrator]');

  return battle;
}

/**
 * Update robot stats after tournament battle.
 * Uses shared updateRobotCombatStats + awardCreditsToUser + awardPrestigeToUser.
 */
export async function updateRobotStatsForTournament(
  robot: Robot,
  battle: Battle,
  _isRobot1: boolean,
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
  const opponentParticipant = await prisma.battleParticipant.findFirst({
    where: {
      battleId: battle.id,
      robotId: { not: robot.id },
    },
  });

  // Update robot combat stats via shared helper
  await updateRobotCombatStats({
    robotId: robot.id,
    finalHP: participant.finalHP,
    combatMaxHP: robot.maxHP,
    newELO: participant.eloAfter,
    isWinner,
    isDraw: false, // No draws in tournaments
    damageDealt: participant.damageDealt,
    damageTakenByOpponent: opponentParticipant?.damageDealt || 0,
    // Single opponent, so the flag is already an exact count.
    opponentsDestroyed: opponentParticipant?.destroyed ? 1 : 0,
    // No league points for tournament battles
    fameIncrement: isWinner ? fameAwarded : 0,
    battleType: 'tournament_1v1',
    stance: robot.stance,
    loadoutType: robot.loadoutType,
  });

  const cycleNumber = await getCurrentCycleNumber();
  await awardPrestigeToUser(robot.userId, isWinner ? prestigeAwarded : 0, cycleNumber, {
    source: 'battle',
    mode: 'tournament_1v1',
    battleId: battle.id,
  });

  return { prestigeAwarded, fameAwarded };
}

/**
 * Award a tournament battle's persisted participant reward exactly once.
 * The recipient robot is part of the event identity, so opposite sides from
 * the same stable remain separate, explainable financial events.
 */
export async function awardTournamentBattleIncome(robot: Robot, battle: Battle): Promise<void> {
  const isWinner = battle.winnerId === robot.id;
  const reward = isWinner ? battle.winnerReward : battle.loserReward;
  const cycleNumber = await getCurrentCycleNumber();

  await awardCreditsWithLedger(
    robot.userId,
    reward ?? 0,
    'battle_income',
    cycleNumber,
    'Tournament battle reward',
    robot.id,
    { battleId: battle.id },
    {
      battleId: battle.id,
      mode: 'tournament_1v1',
      tier: battle.leagueType,
      outcome: isWinner ? 'win' : 'loss',
      participationFloor: battle.loserReward ?? 0,
      winComponent: isWinner ? Math.max(0, (battle.winnerReward ?? 0) - (battle.loserReward ?? 0)) : 0,
      teamSize: 1,
      isBye: false,
    },
  );
}

