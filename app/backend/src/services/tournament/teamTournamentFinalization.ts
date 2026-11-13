/**
 * Team Tournament Battle Finalization
 *
 * The steps that run once a fought team tournament battle is durable:
 * achievements for every participant, and the checkpoint resume that
 * finishes rewards and achievements for a match whose battle row exists
 * (`match.battleId !== null`) without simulating again.
 *
 * The first run and a resume evaluate the same persisted participant facts,
 * so a failure midway through finalization never changes the outcome.
 *
 * @module services/tournament/teamTournamentFinalization
 */

import { Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import { BATTLE_LOG_OMIT } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { TeamBattleResult } from '../../types/teamBattleLogTypes';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { checkAndAwardAchievements, didRobotLosePreviousBattle } from '../battle/battlePostCombat';
import { hasAllocatedTuning, hpPercentOf } from '../battle/battleAchievementContext';
import { loadBattleTimeMaxHP } from '../battle/combatBuildRecorder';
import { distributeTeamTournamentRewards } from './teamTournamentRewards';
import type { TeamTournamentBattleResult } from './teamTournamentBattleOrchestrator';

export interface TeamTournamentAchievementParticipant {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  finalHP: number;
  eloBefore: number;
  eloAfter: number;
}

export async function resumeTeamTournamentBattleFinalization(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
  team1: { stableId: number },
  team2: { stableId: number },
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  teamSize: 2 | 3,
  battleType: 'tournament_2v2' | 'tournament_3v3',
): Promise<TeamTournamentBattleResult> {
  const battle = await prisma.battle.findUnique({
    where: { id: match.battleId! },
    omit: BATTLE_LOG_OMIT,
    include: { participants: true },
  });
  const winningSide = battle?.winningSide as 1 | 2 | null;
  if (!battle || !winningSide || battle.winnerId === null) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Team tournament match ${match.id} cannot resume battle finalization`,
      500,
      { matchId: match.id, battleId: match.battleId },
    );
  }

  const expectedParticipantCount = teamSize * 2;
  if (battle.participants.length !== expectedParticipantCount) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Team tournament battle ${battle.id} is missing participant evidence`,
      500,
      { battleId: battle.id, expectedParticipantCount, actualParticipantCount: battle.participants.length },
    );
  }

  const battleResult: TeamBattleResult = {
    winningSide,
    winnerRobotId: null,
    isDraw: false,
    isByeMatch: false,
    durationSeconds: battle.durationSeconds,
    participants: battle.participants.map((participant) => ({
      robotId: participant.robotId,
      team: participant.team as 1 | 2,
      damageDealt: participant.damageDealt,
      damageTaken: 0,
      finalHP: participant.finalHP,
      survivalSeconds: battle.durationSeconds,
    })),
    battleLog: [],
    detailedCombatEvents: [],
    focusFireEvents: [],
    focusFireMetrics: { team1: 0, team2: 0 },
    allySupportMetrics: { team1: 0, team2: 0 },
    formationDefenceMetrics: { team1: 0, team2: 0 },
    arenaRadius: 0,
    startingPositions: {},
    endingPositions: {},
  };

  await distributeTeamTournamentRewards(
    battle.id,
    tournament,
    winningSide,
    team1Robots,
    team2Robots,
    team1.stableId,
    team2.stableId,
    battleResult,
    teamSize,
  );
  await awardTeamTournamentBattleAchievements(
    battle.id,
    battleType,
    winningSide,
    team1,
    team2,
    battle.participants.map((participant) => ({
      robotId: participant.robotId,
      team: participant.team as 1 | 2,
      damageDealt: participant.damageDealt,
      finalHP: participant.finalHP,
      eloBefore: participant.eloBefore,
      eloAfter: participant.eloAfter,
    })),
    battle.durationSeconds,
    [...team1Robots, ...team2Robots],
    { round: match.round, maxRounds: tournament.maxRounds },
  );

  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: {
      winnerId: battle.winnerId,
      battleId: battle.id,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  return {
    battleId: battle.id,
    winnerId: battle.winnerId,
    participants: battle.participants.map((participant) => ({
      robotId: participant.robotId,
      team: participant.team as 1 | 2,
      damageDealt: participant.damageDealt,
      finalHP: participant.finalHP,
      eloBefore: participant.eloBefore,
      eloAfter: participant.eloAfter,
    })),
    durationSeconds: battle.durationSeconds,
    isByeMatch: false,
    isForfeit: false,
  };
}

export async function awardTeamTournamentBattleAchievements(
  battleId: number,
  battleType: 'tournament_2v2' | 'tournament_3v3',
  winningSide: 1 | 2,
  team1: { stableId: number },
  team2: { stableId: number },
  participants: TeamTournamentAchievementParticipant[],
  battleDurationSeconds: number,
  robots: RobotWithWeapons[],
  bracket: { round: number; maxRounds: number },
): Promise<void> {
  const teamSize = battleType === 'tournament_3v3' ? 3 : 2;
  const teamAllSurvived = (team: 1 | 2): boolean =>
    participants.filter((participant) => participant.team === team).every((participant) => participant.finalHP > 0);
  // Tuning and max HP are read here rather than taken from the battle-time
  // robots, so the first run and a checkpoint resume evaluate the same facts:
  // a resume loads unprepared robots whose maxHP is the stored value, while
  // final HP is on the combat scale recorded in the battle build.
  const [tuningMap, combatMaxHP] = await Promise.all([
    getTuningBonusesBatch(participants.map((participant) => participant.robotId)),
    loadBattleTimeMaxHP(battleId),
  ]);
  const robotsById = new Map(robots.map((robot) => [robot.id, robot]));
  const team1OpponentElo = participants
    .filter((participant) => participant.team === 2)
    .reduce((sum, participant) => sum + participant.eloBefore, 0);
  const team2OpponentElo = participants
    .filter((participant) => participant.team === 1)
    .reduce((sum, participant) => sum + participant.eloBefore, 0);

  await Promise.all(participants.map(async (participant) => {
    const stableId = participant.team === 1 ? team1.stableId : team2.stableId;
    const robot = robotsById.get(participant.robotId);
    if (!robot) {
      // Without the robot its yield, HP and tuning are unknown, and guessing
      // them is what handed out unearned achievements before.
      logger.warn(
        `[TeamTournament] Skipped achievements for robot ${participant.robotId} in battle #${battleId}: robot not loaded`,
      );
      return;
    }
    const previousBattleLost = await didRobotLosePreviousBattle(participant.robotId, battleId);
    await checkAndAwardAchievements(stableId, participant.robotId, {
      won: winningSide === participant.team,
      destroyed: participant.finalHP === 0,
      finalHpPercent: hpPercentOf(participant.finalHP, combatMaxHP.get(participant.robotId) ?? robot.maxHP),
      eloChange: participant.eloAfter - participant.eloBefore,
      opponentElo: participant.team === 1 ? team1OpponentElo : team2OpponentElo,
      yielded: false,
      opponentYielded: false,
      previousBattleLost,
      damageDealt: participant.damageDealt,
      opponentDamageDealt: 0,
      loadoutType: robot.loadoutType || 'single',
      stance: robot.stance || 'balanced',
      yieldThreshold: robot.yieldThreshold,
      hasTuning: hasAllocatedTuning(tuningMap.get(participant.robotId)),
      hasMainWeapon: robot.mainWeaponId !== null,
      battleId,
      isDraw: false,
      teamSize,
      teamAllSurvived: teamAllSurvived(participant.team),
      tournamentRound: bracket.round,
      tournamentMaxRounds: bracket.maxRounds,
      battleType,
      battleDurationSeconds,
    });
  }));
}
