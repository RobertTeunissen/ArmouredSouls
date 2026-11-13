/**
 * Solo Tournament Battle Finalization (checkpoint resume)
 *
 * Finishes a 1v1 tournament match whose battle row already exists
 * (`battleId !== null`): pays the persisted rewards, writes the audit events
 * and evaluates achievements from the stored participant facts, without
 * simulating again.
 *
 * @module services/tournament/tournamentBattleFinalization
 */

import { Robot, ScheduledTournamentMatch } from '../../../generated/prisma';
import type { RobotWithWeapons } from '../battle/combatSimulator';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
} from '../battle/battlePostCombat';
import { hasAllocatedTuning, hpPercentOf } from '../battle/battleAchievementContext';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { getTuningBonusesBatch } from '../tuning-pool';
import { evaluateCombatEntry } from '../battle/combatReadiness';
import { loadBattleTimeMaxHP } from '../battle/combatBuildRecorder';
import { awardTournamentBattleIncome } from './tournamentBattleRecord';
import type { TournamentBattleResult } from './tournamentBattleOrchestrator';

export async function resumeTournamentBattleFinalization(
  tournamentMatch: ScheduledTournamentMatch,
): Promise<TournamentBattleResult> {
  const battle = await prisma.battle.findUnique({ where: { id: tournamentMatch.battleId! } });
  // Weapons are loaded so the battle loadout can be re-derived below.
  const withWeapons = { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } };
  const [robot1, robot2] = await Promise.all([
    prisma.robot.findUnique({ where: { id: tournamentMatch.participant1Id! }, include: withWeapons }),
    prisma.robot.findUnique({ where: { id: tournamentMatch.participant2Id! }, include: withWeapons }),
  ]);
  if (!battle || !robot1 || !robot2 || battle.winnerId === null) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Tournament match ${tournamentMatch.id} cannot resume battle finalization`,
      500,
      { matchId: tournamentMatch.id, battleId: tournamentMatch.battleId },
    );
  }

  const [robot1Participant, robot2Participant] = await Promise.all([
    prisma.battleParticipant.findUnique({ where: { battleId_robotId: { battleId: battle.id, robotId: robot1.id } } }),
    prisma.battleParticipant.findUnique({ where: { battleId_robotId: { battleId: battle.id, robotId: robot2.id } } }),
  ]);
  if (!robot1Participant || !robot2Participant) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Tournament battle ${battle.id} is missing participant evidence`,
      500,
      { battleId: battle.id },
    );
  }

  // Every operation below is either idempotent by its battle/robot identity or
  // best-effort by design. A retry must finish the *same* persisted battle and
  // only acknowledge the bracket after its post-battle work is complete.
  await awardTournamentBattleIncome(robot1, battle);
  await awardTournamentBattleIncome(robot2, battle);
  const [streamingRevenue1, streamingRevenue2] = await Promise.all([
    awardStreamingRevenueForParticipant(robot1.id, robot1.userId, battle.id, false, 1, 'tournament_1v1'),
    awardStreamingRevenueForParticipant(robot2.id, robot2.userId, battle.id, false, 1, 'tournament_1v1'),
  ]);

  const robot1IsWinner = battle.winnerId === robot1.id;
  const robot2IsWinner = battle.winnerId === robot2.id;
  const auditBattle = {
    id: battle.id,
    battleType: 'tournament_1v1',
    leagueType: 'tournament',
    durationSeconds: battle.durationSeconds,
  };
  await Promise.all([
    logTournamentParticipantAudit(
      robot1, robot1Participant, robot2.id, robot1IsWinner, robot2Participant,
      auditBattle, streamingRevenue1?.totalRevenue ?? 0,
    ),
    logTournamentParticipantAudit(
      robot2, robot2Participant, robot1.id, robot2IsWinner, robot1Participant,
      auditBattle, streamingRevenue2?.totalRevenue ?? 0,
    ),
  ]);

  const [robot1PrevLost, robot2PrevLost] = await Promise.all([
    didRobotLosePreviousBattle(robot1.id, battle.id),
    didRobotLosePreviousBattle(robot2.id, battle.id),
  ]);
  // Rule 6: the single-weapon fallback is in memory only, so re-derive it from
  // the reloaded loadout (same rule as battle time). A robot that fought as
  // single earns no loadout-specific achievement credit on a resume.
  const battleLoadout = (robot: RobotWithWeapons): string =>
    (evaluateCombatEntry(robot).loadoutFallback ? 'single' : robot.loadoutType) || 'single';
  // The battle-time tuning map, combat events and prepared robots are gone on a
  // resume; read the allocations, bracket size and battle-time max HP again.
  // These robots are unprepared (stored maxHP) while final HP is on the combat
  // scale, so HP percentages use the max HP rebuilt from the recorded build.
  // C19 falls back to final HP.
  const [tuningMap, bracket, combatMaxHP] = await Promise.all([
    getTuningBonusesBatch([robot1.id, robot2.id]),
    prisma.tournament.findUnique({ where: { id: tournamentMatch.tournamentId }, select: { maxRounds: true } }),
    loadBattleTimeMaxHP(battle.id),
  ]);
  const maxHP1 = combatMaxHP.get(robot1.id) ?? robot1.maxHP;
  const maxHP2 = combatMaxHP.get(robot2.id) ?? robot2.maxHP;
  const resumeTournamentContext = {
    battleId: battle.id,
    isDraw: false,
    tournamentRound: tournamentMatch.round,
    tournamentMaxRounds: bracket?.maxRounds,
  };
  const [unlocks1, unlocks2] = await Promise.all([
    checkAndAwardAchievements(robot1.userId, robot1.id, {
      won: robot1IsWinner,
      destroyed: robot2Participant.destroyed,
      finalHpPercent: hpPercentOf(robot1Participant.finalHP, maxHP1),
      eloChange: robot1Participant.eloAfter - robot1Participant.eloBefore,
      subjectEloBefore: robot1Participant.eloBefore,
      opponentEloBefore: robot2Participant.eloBefore,
      opponentElo: robot2.elo,
      yielded: robot1Participant.yielded,
      opponentYielded: robot2Participant.yielded,
      previousBattleLost: robot1PrevLost,
      damageDealt: robot1Participant.damageDealt,
      opponentDamageDealt: robot2Participant.damageDealt,
      loadoutType: battleLoadout(robot1),
      stance: robot1.stance || 'balanced',
      yieldThreshold: robot1.yieldThreshold,
      hasTuning: hasAllocatedTuning(tuningMap.get(robot1.id)),
      hasMainWeapon: robot1.mainWeaponId !== null,
      battleType: 'tournament_1v1',
      battleDurationSeconds: battle.durationSeconds,
      ...resumeTournamentContext,
      opponentRobotId: robot2.id,
      opponentFinalHpPercent: hpPercentOf(robot2Participant.finalHP, maxHP2),
    }),
    checkAndAwardAchievements(robot2.userId, robot2.id, {
      won: robot2IsWinner,
      destroyed: robot1Participant.destroyed,
      finalHpPercent: hpPercentOf(robot2Participant.finalHP, maxHP2),
      eloChange: robot2Participant.eloAfter - robot2Participant.eloBefore,
      subjectEloBefore: robot2Participant.eloBefore,
      opponentEloBefore: robot1Participant.eloBefore,
      opponentElo: robot1.elo,
      yielded: robot2Participant.yielded,
      opponentYielded: robot1Participant.yielded,
      previousBattleLost: robot2PrevLost,
      damageDealt: robot2Participant.damageDealt,
      opponentDamageDealt: robot1Participant.damageDealt,
      loadoutType: battleLoadout(robot2),
      stance: robot2.stance || 'balanced',
      yieldThreshold: robot2.yieldThreshold,
      hasTuning: hasAllocatedTuning(tuningMap.get(robot2.id)),
      hasMainWeapon: robot2.mainWeaponId !== null,
      battleType: 'tournament_1v1',
      battleDurationSeconds: battle.durationSeconds,
      ...resumeTournamentContext,
      opponentRobotId: robot1.id,
      opponentFinalHpPercent: hpPercentOf(robot1Participant.finalHP, maxHP1),
    }),
  ]);

  await prisma.scheduledTournamentMatch.update({
    where: { id: tournamentMatch.id },
    data: { winnerId: battle.winnerId, status: 'completed', completedAt: new Date() },
  });

  return {
    battleId: battle.id,
    winnerId: battle.winnerId,
    robot1FinalHP: robot1Participant.finalHP,
    robot2FinalHP: robot2Participant.finalHP,
    robot1Damage: robot1Participant.damageDealt,
    robot2Damage: robot2Participant.damageDealt,
    durationSeconds: battle.durationSeconds,
    prestigeAwarded: robot1Participant.prestigeAwarded + robot2Participant.prestigeAwarded,
    fameAwarded: robot1Participant.fameAwarded + robot2Participant.fameAwarded,
    isByeMatch: false,
    isForfeit: false,
    achievementUnlocks: [...unlocks1, ...unlocks2],
  };
}

async function logTournamentParticipantAudit(
  robot: Robot,
  participant: { damageDealt: number; finalHP: number; yielded: boolean; destroyed: boolean; credits: number; prestigeAwarded: number; fameAwarded: number; eloBefore: number; eloAfter: number },
  opponentId: number,
  isWinner: boolean,
  opponentParticipant: { damageDealt: number },
  battle: { id: number; battleType: string; leagueType: string; durationSeconds: number },
  streamingRevenue: number,
): Promise<void> {
  try {
    await logBattleAuditEvent(
      {
        robotId: robot.id,
        userId: robot.userId,
        isWinner,
        isDraw: false,
        damageDealt: participant.damageDealt,
        finalHP: participant.finalHP,
        yielded: participant.yielded,
        destroyed: participant.destroyed,
        credits: participant.credits,
        prestige: participant.prestigeAwarded,
        fame: participant.fameAwarded,
        eloBefore: participant.eloBefore,
        eloAfter: participant.eloAfter,
      },
      { ...battle, eloChange: Math.abs(participant.eloAfter - participant.eloBefore) },
      opponentId,
      streamingRevenue,
      false,
      {},
      `battle-complete:${battle.id}:${robot.id}`,
    );
  } catch (error) {
    logger.error(`[TournamentBattleOrchestrator] Audit log failed for robot ${robot.id} in battle #${battle.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

