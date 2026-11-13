/**
 * Tournament Battle Orchestrator
 * Handles tournament-specific battle execution and rewards
 * 
 * Tournament bye matches are resolved at current-round processing through the
 * shared no-simulation Bye_Record writer. They do not call the combat engine,
 * but they do create a resolved battle and award the tournament participation
 * floor once the round is processed.
 * League bye matches (against "Bye Robot") are handled in battleOrchestrator.ts
 * and follow their existing path.
 */

import { ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { simulateBattle } from '../battle/combatSimulator';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  type UnlockedAchievement,
} from '../battle/battlePostCombat';
import { hasAllocatedTuning, hpPercentOf, lowestHpPercent } from '../battle/battleAchievementContext';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { recoverTournamentMatch } from '../battle/matchFailurePolicy';
import { evaluateMatchEntry } from '../battle/combatReadiness';
import { applyAndLogLoadoutFallbacks, loadCombatRobot, prepareRobotsWithTuning } from '../battle/battlePreparation';
import { completeByeMatch, getCurrentRoundMatches } from './tournamentService';
import { resolveSoloTournamentForfeit } from './tournamentForfeit';
import {
  awardTournamentBattleIncome,
  createTournamentBattleRecord,
  updateRobotStatsForTournament,
} from './tournamentBattleRecord';
import { resumeTournamentBattleFinalization } from './tournamentBattleFinalization';

export interface TournamentBattleResult {
  battleId: number;
  /** The participant advancing in the bracket (the higher seed on a double forfeit). */
  winnerId: number;
  /** True when the match was resolved as a battle-time forfeit (nothing simulated). */
  isForfeit: boolean;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1Damage: number;
  robot2Damage: number;
  durationSeconds: number;
  prestigeAwarded: number;
  fameAwarded: number;
  isByeMatch: boolean;
  achievementUnlocks: UnlockedAchievement[];
}

/**
 * Process a tournament match battle
 * 
 * Note: Tournament bye matches must be routed to `completeByeMatch` by the
 * current-round processor. This function handles fought matches only; the
 * shared bye writer creates the resolved battle and reward without simulation.
 */
export async function processTournamentBattle(
  tournamentMatch: ScheduledTournamentMatch
): Promise<TournamentBattleResult> {
  if (!tournamentMatch.participant1Id || !tournamentMatch.participant2Id) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Tournament match ${tournamentMatch.id} missing robots`,
      400,
      { matchId: tournamentMatch.id }
    );
  }

  if (tournamentMatch.isByeMatch) {
    throw new TournamentError(
      TournamentErrorCode.INVALID_MATCH_STATE,
      `Bye match ${tournamentMatch.id} should not be processed as a battle`,
      400,
      { matchId: tournamentMatch.id, isByeMatch: true }
    );
  }

  if (tournamentMatch.battleId !== null) {
    return resumeTournamentBattleFinalization(tournamentMatch);
  }

  // Load both robots with weapons
  // For 1v1 tournaments (participantType='robot'), participant IDs ARE robot IDs
  const robot1 = await loadCombatRobot(tournamentMatch.participant1Id);
  const robot2 = await loadCombatRobot(tournamentMatch.participant2Id);

  if (!robot1 || !robot2) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Robots not found for tournament match ${tournamentMatch.id}`,
      404,
      { matchId: tournamentMatch.id, participant1Id: tournamentMatch.participant1Id, participant2Id: tournamentMatch.participant2Id }
    );
  }

  // Battle-time readiness (rule 1): checked on the loaded weapon relations,
  // after the resume short-circuit so a linked fought battle never forfeits.
  // No main weapon forfeits (rule 5: eliminated); an incomplete loadout fights
  // as single (rule 6).
  const entry = evaluateMatchEntry([robot1], [robot2]);
  if (entry.kind !== 'fight') {
    return resolveSoloTournamentForfeit(tournamentMatch, robot1, robot2, entry);
  }
  // In memory only, and before prepareRobotForCombat reads loadoutType.
  applyAndLogLoadoutFallbacks([robot1, robot2], entry.decisions, tournamentMatch.id);

  // Robots enter battles fully repaired
  // Fetch tuning bonuses in a single batch query and prepare robots for combat
  const tuningMap = await prepareRobotsWithTuning([robot1, robot2]);

  // Simulate battle with tournament mode (resolves draws with HP tiebreaker)
  const combatResult = simulateBattle(robot1, robot2, true);

  // Get tournament for round information and participant count
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentMatch.tournamentId },
  });

  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentMatch.tournamentId} not found`,
      404,
      { tournamentId: tournamentMatch.tournamentId }
    );
  }

  // Count robots remaining in current round (including bye robots)
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
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

  // The battle and non-repeatable robot stat updates are now durable. Keep the
  // scheduling row executable until its idempotent financial finalization ends;
  // a retry resumes this battle instead of simulating a replacement.
  await prisma.scheduledTournamentMatch.update({
    where: { id: tournamentMatch.id },
    data: { battleId: battle.id, status: 'scheduled' },
  });

  await awardTournamentBattleIncome(robot1, battle);
  await awardTournamentBattleIncome(robot2, battle);

  // Calculate and award streaming revenue (Requirement 16.1-16.7)
  // Tournament battles award streaming revenue using the same formula as 1v1 battles
  // No streaming revenue for bye matches (handled by isByeMatch check at function start)
  const streamingRevenue1 = await awardStreamingRevenueForParticipant(robot1.id, robot1.userId, battle.id, false, 1, 'tournament_1v1');
  const streamingRevenue2 = await awardStreamingRevenueForParticipant(robot2.id, robot2.userId, battle.id, false, 1, 'tournament_1v1');

  if (streamingRevenue1) {
    logger.info(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }
  if (streamingRevenue2) {
    logger.info(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Tournament Battle #${battle.id}`);
  }

  // Log battle_complete events to audit log - ONE EVENT PER ROBOT
  // Get participant data for audit logging
  const robot1Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot1.id } },
  });
  const robot2Participant = await prisma.battleParticipant.findUnique({
    where: { battleId_robotId: { battleId: battle.id, robotId: robot2.id } },
  });
  
  if (!robot1Participant || !robot2Participant) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `BattleParticipant records not found for battle ${battle.id}`,
      500,
      { battleId: battle.id }
    );
  }
  
  // Determine results for each robot
  const robot1IsWinner = battle.winnerId === robot1.id;
  const robot2IsWinner = battle.winnerId === robot2.id;
  const isDraw = battle.winnerId === null;
  
  // Event 1: Robot 1's perspective
  // Event 2: Robot 2's perspective
  // Non-blocking: audit failures must never crash a battle
  try {
    await logBattleAuditEvent(
      {
        robotId: robot1.id,
        userId: robot1.userId,
        isWinner: robot1IsWinner,
        isDraw,
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
      { id: battle.id, battleType: 'tournament_1v1', leagueType: 'tournament', durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot1Participant.eloAfter - robot1Participant.eloBefore) },
      robot2.id,
      streamingRevenue1?.totalRevenue || 0,
      false,
      {},
      `battle-complete:${battle.id}:${robot1.id}`,
    );
  } catch (auditError) {
    logger.error(`[TournamentBattleOrchestrator] Audit log failed for robot ${robot1.id} in battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }

  try {
    await logBattleAuditEvent(
      {
        robotId: robot2.id,
        userId: robot2.userId,
        isWinner: robot2IsWinner,
        isDraw,
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
      { id: battle.id, battleType: 'tournament_1v1', leagueType: 'tournament', durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot2Participant.eloAfter - robot2Participant.eloBefore) },
      robot1.id,
      streamingRevenue2?.totalRevenue || 0,
      false,
      {},
      `battle-complete:${battle.id}:${robot2.id}`,
    );
  } catch (auditError) {
    logger.error(`[TournamentBattleOrchestrator] Audit log failed for robot ${robot2.id} in battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }

  // Check and award achievements for both robots (battle_complete + tournament_complete for winner)
  let achievementUnlocks: UnlockedAchievement[];
  {
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
        eloChange: robot1Participant.eloAfter - robot1Participant.eloBefore,
        // Spec #46 R8 Cause B: upsets compare pre-battle ratings, not the
        // subject's ELO change, which ELO_K_FACTOR bounds at 32.
        subjectEloBefore: robot1Participant.eloBefore,
        opponentEloBefore: robot2Participant.eloBefore,
        opponentElo: robot2.elo,
        yielded: robot1Participant.yielded,
        opponentYielded: robot2Participant.yielded,
        previousBattleLost: robot1PrevLost,
        damageDealt: robot1Participant.damageDealt,
        opponentDamageDealt: robot2Participant.damageDealt,
        loadoutType: robot1.loadoutType || 'single',
        stance: robot1.stance || 'balanced',
        yieldThreshold: robot1.yieldThreshold,
        hasTuning: hasAllocatedTuning(tuningMap.get(robot1.id)),
        hasMainWeapon: robot1.mainWeaponId !== null,
        battleType: 'tournament_1v1',
        battleDurationSeconds: combatResult.durationSeconds,
        battleId: battle.id,
        isDraw: false,
        opponentRobotId: robot2.id,
        opponentFinalHpPercent: hpPercentOf(robot2Participant.finalHP, robot2.maxHP),
        minHpPercent: lowestHpPercent(combatResult.events, robot1.name, robot1.maxHP, robot1Participant.finalHP),
        tournamentRound: tournamentMatch.round,
        tournamentMaxRounds: tournament.maxRounds,
      }),
      checkAndAwardAchievements(robot2.userId, robot2.id, {
        won: robot2IsWinner,
        destroyed: robot1Participant.destroyed,
        finalHpPercent: robot2.maxHP > 0 ? (robot2Participant.finalHP / robot2.maxHP) * 100 : 0,
        eloChange: robot2Participant.eloAfter - robot2Participant.eloBefore,
        subjectEloBefore: robot2Participant.eloBefore,
        opponentEloBefore: robot1Participant.eloBefore,
        opponentElo: robot1.elo,
        yielded: robot2Participant.yielded,
        opponentYielded: robot1Participant.yielded,
        previousBattleLost: robot2PrevLost,
        damageDealt: robot2Participant.damageDealt,
        opponentDamageDealt: robot1Participant.damageDealt,
        loadoutType: robot2.loadoutType || 'single',
        stance: robot2.stance || 'balanced',
        yieldThreshold: robot2.yieldThreshold,
        hasTuning: hasAllocatedTuning(tuningMap.get(robot2.id)),
        hasMainWeapon: robot2.mainWeaponId !== null,
        battleType: 'tournament_1v1',
        battleDurationSeconds: combatResult.durationSeconds,
        battleId: battle.id,
        isDraw: false,
        opponentRobotId: robot1.id,
        opponentFinalHpPercent: hpPercentOf(robot1Participant.finalHP, robot1.maxHP),
        minHpPercent: lowestHpPercent(combatResult.events, robot2.name, robot2.maxHP, robot2Participant.finalHP),
        tournamentRound: tournamentMatch.round,
        tournamentMaxRounds: tournament.maxRounds,
      }),
    ]);
    achievementUnlocks = [...unlocks1, ...unlocks2];
  }

  await prisma.scheduledTournamentMatch.update({
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
  
  logger.info(
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
    isForfeit: false,
    achievementUnlocks,
  };
}

/** Outcome of one solo tournament round run by `executeSoloTournamentRound`. */
export interface SoloRoundExecutionResult {
  /** Fought matches (including crash-recovery resumes of a linked battle). */
  matchesExecuted: number;
  byesResolved: number;
  /** Matches resolved as battle-time forfeits (single or double; nothing simulated). */
  forfeits: number;
  /** Matches whose linked fought battle was finalised by the in-run resume after an error. */
  matchesResumed: number;
  /** Matches handed to the failure policy (cancelled, R1 higher seed, or finalised after error). */
  matchesCancelled: number;
  /** Participants advancing from fought and forfeited matches, in processing order. */
  winners: number[];
  errors: string[];
}

/**
 * Run every queued match of a solo tournament's current round (design §5.4).
 *
 * The one round executor for the cron job, the admin bulk cycle and the admin
 * route. A failing match never fails the round (rule 7): its error goes to
 * `recoverTournamentMatch`, which resumes a linked fought battle once and
 * otherwise applies the shared failure policy. Callers then run
 * `advanceWinnersToNextRound` as before.
 */
export async function executeSoloTournamentRound(tournamentId: number): Promise<SoloRoundExecutionResult> {
  const result: SoloRoundExecutionResult = {
    matchesExecuted: 0,
    byesResolved: 0,
    forfeits: 0,
    matchesResumed: 0,
    matchesCancelled: 0,
    winners: [],
    errors: [],
  };

  const matches = await getCurrentRoundMatches(tournamentId);
  for (const match of matches) {
    try {
      if (match.isByeMatch) {
        const id = match.participant1Id ?? match.participant2Id;
        // completeByeMatch catches its own errors and returns false; turn that
        // into a throw so the policy sees it and the row never stays pending.
        if (id === null || !(await completeByeMatch(match, id))) {
          throw new TournamentError(
            TournamentErrorCode.INVALID_MATCH_STATE,
            `Bye ${match.id} did not produce a Bye_Record`,
            400,
            { matchId: match.id }
          );
        }
        result.byesResolved++;
        continue;
      }
      const battle = await processTournamentBattle(match);
      if (battle.isForfeit) {
        result.forfeits++;
      } else {
        result.matchesExecuted++;
      }
      result.winners.push(battle.winnerId);
    } catch (error) {
      const recovery = await recoverTournamentMatch({
        mode: 'tournament_1v1',
        matchId: match.id,
        error,
        resume: (row) => processTournamentBattle(row),
      });
      if (recovery.outcome === 'resumed') {
        result.matchesResumed++;
      } else {
        result.matchesCancelled++;
        result.errors.push(`Match ${match.id}: ${recovery.errorSummary}`);
      }
    }
  }

  logger.info(
    `[Tournament] Round executed for tournament ${tournamentId}: ${result.matchesExecuted} fought, ` +
    `${result.byesResolved} byes, ${result.forfeits} forfeits, ${result.matchesResumed} resumed, ${result.matchesCancelled} failed`
  );
  return result;
}
