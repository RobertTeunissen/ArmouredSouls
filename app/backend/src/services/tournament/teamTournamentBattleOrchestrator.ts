/**
 * Team Tournament Battle Orchestrator
 *
 * Handles team tournament match execution by dispatching to the Team Battle Engine.
 * Creates Battle + BattleParticipant records, updates match status, and handles
 * draw tiebreaking (Task 5.2) and reward distribution (Task 5.3).
 *
 * Battle-time entry (design §5.5): one per-side decision for both sides,
 * `decideTeamTournamentEntry` — a side forfeits if its roster/subscriptions are
 * ineligible or any member has no main weapon. Every forfeit (roster or weapon,
 * single or double) goes through the shared Forfeit_Resolution_Writer, exactly
 * like the other two-sided modes.
 *
 * This module implements the core match execution flow:
 *   load teams → entry check → prepare → simulate → create battle record → update match
 *
 * The entry decision and forfeits live in `teamTournamentEntry`, reward
 * distribution in `teamTournamentRewards`.
 *
 * Requirements: R4.1, R4.2, R4.3, R4.5, R4.6, R5.5, R5.6
 *
 * @module services/tournament/teamTournamentBattleOrchestrator
 */

import { Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import { encodeBattleLog } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { simulateTeamBattle } from '../team-battle/teamBattleEngine';
import { calculateTeamBattleELOChanges } from '../team-battle/teamBattleRewardService';
import {
  buildTeamBattleLog,
  updateTeamBattleCombatStats,
  writeTeamBattleSummary,
} from '../team-battle/teamBattlePostCombat';
import { TeamBattleResult, TeamBattleLog } from '../../types/teamBattleLogTypes';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { completeByeMatch } from './tournamentService';
import { recoverTournamentMatch } from '../battle/matchFailurePolicy';
import { evaluateMatchEntry } from '../battle/combatReadiness';
import {
  applyAndLogLoadoutFallbacks,
  loadCombatRobots,
  prepareRobotsWithTuning,
} from '../battle/battlePreparation';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';
import { decideTeamTournamentEntry, resolveTeamTournamentForfeit } from './teamTournamentEntry';
import { calculateTeamTournamentFameAward, distributeTeamTournamentRewards } from './teamTournamentRewards';
import {
  awardTeamTournamentBattleAchievements,
  resumeTeamTournamentBattleFinalization,
} from './teamTournamentFinalization';

// ─── Public Interfaces ───────────────────────────────────────────────────────

export interface TeamTournamentParticipantResult {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  finalHP: number;
  eloBefore: number;
  eloAfter: number;
}

export interface TeamTournamentBattleResult {
  battleId: number;
  /** The team advancing in the bracket (the higher seed on a double forfeit). */
  winnerId: number;
  participants: TeamTournamentParticipantResult[];
  durationSeconds: number;
  isByeMatch: boolean;
  /** True when the match was resolved as a forfeit (nothing simulated). */
  isForfeit: boolean;
}

export interface RoundExecutionResult {
  /** Fought matches, byes and empty-placeholder housekeeping. */
  matchesExecuted: number;
  /** Matches that threw at least once. */
  matchesFailed: number;
  /** Matches resolved as forfeits (roster or weapon, single or double; nothing simulated). */
  matchesForfeited: number;
  /** Matches whose linked fought battle was finalised by a resume (round start or in-run retry). */
  matchesResumed: number;
  /** Matches handed to the failure policy (cancelled, R1 higher seed, or finalised after error). */
  matchesCancelled: number;
}

// ─── Main Export: Process Single Match ────────────────────────────────────────

/**
 * Execute a single team tournament match.
 *
 * Flow:
 * 1. Determine teamSize and battleType from tournament participantType
 * 2. Load both teams with members and robot weapons
 * 3. Prepare all 2N robots for combat (full HP, shield, tuning bonuses)
 * 4. Simulate team battle via Team Battle Engine
 * 5. Handle draw tiebreaking (R4.4)
 * 6. Create Battle record with tournament context
 * 7. Create BattleParticipant records for all 2N robots
 * 8. Update match: winnerId, battleId, status='completed', completedAt
 *
 * @param match - The scheduled tournament match to execute
 * @param tournament - The parent tournament record
 * @returns Battle result with winner and participant stats
 */
export async function processTeamTournamentBattle(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
): Promise<TeamTournamentBattleResult> {
  // 1. Determine team size and battle type
  const teamSize: 2 | 3 = tournament.participantType === 'team_2v2' ? 2 : 3;
  const battleType = tournament.participantType === 'team_2v2' ? 'tournament_2v2' : 'tournament_3v3';

  if (!match.participant1Id || !match.participant2Id) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Team tournament match ${match.id} missing participants`,
      400,
      { matchId: match.id, participant1Id: match.participant1Id, participant2Id: match.participant2Id },
    );
  }

  if (match.isByeMatch) {
    throw new TournamentError(
      TournamentErrorCode.INVALID_MATCH_STATE,
      `Bye match ${match.id} should not be processed as a battle`,
      400,
      { matchId: match.id, isByeMatch: true },
    );
  }

  // 2. Load both teams with members and robot weapons
  const team1 = await prisma.teamBattle.findUnique({
    where: { id: match.participant1Id },
    include: {
      members: { include: { robot: true } },
      stable: true,
    },
  });

  const team2 = await prisma.teamBattle.findUnique({
    where: { id: match.participant2Id },
    include: {
      members: { include: { robot: true } },
      stable: true,
    },
  });

  if (!team1 || !team2) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Teams not found for tournament match ${match.id}`,
      404,
      { matchId: match.id, participant1Id: match.participant1Id, participant2Id: match.participant2Id },
    );
  }

  // Load robots with full weapon data (including refinements)
  const team1RobotIds = team1.members.map(m => m.robotId);
  const team2RobotIds = team2.members.map(m => m.robotId);

  const team1Robots: RobotWithWeapons[] = await loadCombatRobots(team1RobotIds);
  const team2Robots: RobotWithWeapons[] = await loadCombatRobots(team2RobotIds);

  if (team1Robots.length !== teamSize || team2Robots.length !== teamSize) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Team composition mismatch for match ${match.id}: team1=${team1Robots.length}, team2=${team2Robots.length}, expected=${teamSize}`,
      400,
      { matchId: match.id, team1Count: team1Robots.length, team2Count: team2Robots.length, teamSize },
    );
  }

  if (match.battleId !== null) {
    return resumeTeamTournamentBattleFinalization(
      match,
      tournament,
      team1,
      team2,
      team1Robots,
      team2Robots,
      teamSize,
      battleType,
    );
  }

  // Battle-time readiness backstop (rule 1). The executor's entry decision has
  // normally passed already, but a player can unequip in between: a side with a
  // robot lacking a main weapon forfeits through the shared writer, it is never
  // simulated. An incomplete loadout fights as single (rule 6).
  const entry = evaluateMatchEntry(team1Robots, team2Robots);
  if (entry.kind !== 'fight') {
    const forfeits = (side: 1 | 2): boolean =>
      entry.kind === 'double_forfeit' || entry.forfeitingSides[0] === side;
    return resolveTeamTournamentForfeit(match, tournament, [
      { participantId: team1.id, team: team1, robots: team1Robots, forfeited: forfeits(1) },
      { participantId: team2.id, team: team2, robots: team2Robots, forfeited: forfeits(2) },
    ]);
  }
  // In memory only, and before prepareRobotForCombat reads loadoutType.
  applyAndLogLoadoutFallbacks([...team1Robots, ...team2Robots], entry.decisions, match.id);

  // 3. Prepare all 2N robots for combat (full HP, shield, tuning bonuses)
  await prepareRobotsWithTuning([...team1Robots, ...team2Robots]);

  // 4. Simulate team battle via Team Battle Engine
  const battleResult = simulateTeamBattle(team1Robots, team2Robots, teamSize);

  // 5. Handle draw tiebreaking (R4.4)
  const { winningSide, winningTeamId } = resolveDraw(
    battleResult,
    match.participant1Id,
    match.participant2Id,
  );

  // Compute team ELOs for ELO change calculation
  const team1SumELO = team1Robots.reduce((sum, r) => sum + r.elo, 0);
  const team2SumELO = team2Robots.reduce((sum, r) => sum + r.elo, 0);

  const team1Won = winningSide === 1;
  const isDraw = false; // Tournament matches never end in a draw after tiebreaking

  // Calculate ELO changes
  const eloChanges = calculateTeamBattleELOChanges(
    team1SumELO,
    team2SumELO,
    team1Won,
    isDraw,
  );

  // 6. Create Battle record with tournament context
  const battle = await prisma.battle.create({
    data: {
      winnerId: winningTeamId,
      // Written with the row (#453): the resume path rejects battles without a winning side
      winningSide,
      battleType,
      leagueType: 'tournament',
      tournamentId: tournament.id,
      tournamentRound: tournament.currentRound,
      durationSeconds: Math.round(battleResult.durationSeconds),
      winnerReward: 0, // Rewards handled in Task 5.3
      loserReward: 0,

      ...(await encodeBattleLog(buildTeamTournamentBattleLog(battleResult, teamSize, tournament))),
    },
  });

  // 7. Create BattleParticipant records for all 2N robots
  const participantRecords = battleResult.participants.map(p => {
    const isTeam1 = p.team === 1;
    const robot = isTeam1
      ? team1Robots.find(r => r.id === p.robotId)
      : team2Robots.find(r => r.id === p.robotId);
    const eloBefore = robot?.elo ?? 0;
    const eloAfter = eloBefore + (isTeam1 ? eloChanges.team1Change : eloChanges.team2Change);

    return {
      battleId: battle.id,
      robotId: p.robotId,
      team: p.team,
      role: null as string | null,
      credits: 0, // Rewards handled in Task 5.3
      streamingRevenue: 0,
      eloBefore,
      eloAfter,
      prestigeAwarded: 0, // Rewards handled in Task 5.3
      fameAwarded: 0,
      damageDealt: Math.round(p.damageDealt),
      finalHP: Math.round(p.finalHP),
      yielded: false,
      destroyed: p.finalHP === 0,
    };
  });

  await prisma.battleParticipant.createMany({ data: participantRecords });
  await recordCombatBuilds(battle.id, battleType, [...team1Robots, ...team2Robots]);

  // Write pre-computed battle summary (Spec #39)
  await writeTeamBattleSummary(battle.id, battleType, battleResult, team1Robots, team2Robots, '[team-tournament]');

  const winnerFame = await calculateTeamTournamentFameAward(
    tournament,
    winningSide,
    team1Robots,
    team2Robots,
    battleResult,
  );

  // Update robot combat stats via shared helper (HP, ELO, counters, damage
  // lifetime, per-robot destruction credit)
  await updateTeamBattleCombatStats({
    result: battleResult,
    sides: [
      { team: 1, robots: team1Robots, eloChange: eloChanges.team1Change, isWinner: winningSide === 1, fameIncrement: winningSide === 1 ? winnerFame : 0 },
      { team: 2, robots: team2Robots, eloChange: eloChanges.team2Change, isWinner: winningSide === 2, fameIncrement: winningSide === 2 ? winnerFame : 0 },
    ],
    teamSize,
    isDraw,
    battleType,
  });

  // The simulator and incrementing combat stats are now durable. Keep the
  // row runnable until financial and achievement finalization has succeeded.
  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: {
      winnerId: winningTeamId,
      battleId: battle.id,
      status: 'scheduled',
      completedAt: null,
    },
  });

  // 9. Distribute rewards (credits, prestige, fame, streaming revenue)
  const rewards = await distributeTeamTournamentRewards(
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

  // 10. Check achievements using the same persisted participant facts that a
  // checkpoint retry receives. This makes first-run and resume evaluation
  // identical even if failure occurs midway through finalization.
  await awardTeamTournamentBattleAchievements(
    battle.id,
    battleType,
    winningSide,
    team1,
    team2,
    participantRecords.map((participant) => ({
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
      winnerId: winningTeamId,
      battleId: battle.id,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Build participant results for return
  const participants: TeamTournamentParticipantResult[] = participantRecords.map(p => ({
    robotId: p.robotId,
    team: p.team as 1 | 2,
    damageDealt: p.damageDealt,
    finalHP: p.finalHP,
    eloBefore: p.eloBefore,
    eloAfter: p.eloAfter,
  }));

  logger.info(
    `[TeamTournament] Match ${match.id} completed | ` +
    `tournament=${tournament.name} round=${tournament.currentRound} ` +
    `team1=${team1.teamName}(${match.participant1Id}) vs team2=${team2.teamName}(${match.participant2Id}) | ` +
    `winner=${winningTeamId === match.participant1Id ? team1.teamName : team2.teamName} ` +
    `duration=${battleResult.durationSeconds.toFixed(1)}s | ` +
    `rewards: winner=₡${rewards.winnerReward.toLocaleString()} loser=₡${rewards.loserReward.toLocaleString()} ` +
    `prestige=+${rewards.winnerPrestige} fame=+${rewards.winnerFame}`,
  );

  return {
    battleId: battle.id,
    winnerId: winningTeamId,
    participants,
    durationSeconds: battleResult.durationSeconds,
    isByeMatch: false,
    isForfeit: false,
  };
}


// ─── Main Export: Execute Round ──────────────────────────────────────────────

/**
 * Execute all pending matches in the current round of a team tournament.
 *
 * For each pending non-bye match, in this order (design §5.5):
 * 1. Resume first: a match with a linked fought battle is finalised by
 *    processTeamTournamentBattle and never reaches the entry gate.
 * 2. One per-side entry decision (`decideTeamTournamentEntry`): a forfeit is
 *    resolved through the shared writer.
 * 3. Otherwise fight via processTeamTournamentBattle (with its own backstop).
 * On failure the shared tournament policy runs (rule 7) and the round goes on.
 *
 * @param tournamentId - ID of the tournament to execute
 * @param teamSize - Team size (2 or 3)
 * @returns Execution summary per outcome
 */
export async function executeTeamTournamentRound(
  tournamentId: number,
  _teamSize: 2 | 3,
): Promise<RoundExecutionResult> {
  // 1. Load tournament
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });

  if (!tournament) {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament ${tournamentId} not found`,
      404,
      { tournamentId },
    );
  }

  if (tournament.status !== 'active') {
    throw new TournamentError(
      TournamentErrorCode.TOURNAMENT_NOT_ACTIVE,
      `Tournament ${tournamentId} is not active (status: ${tournament.status})`,
      400,
      { tournamentId, status: tournament.status },
    );
  }

  // 2. Get pending matches for current round
  const pendingMatches = await prisma.scheduledTournamentMatch.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ['pending', 'scheduled'] },
    },
    orderBy: { matchNumber: 'asc' },
  });

  logger.info(
    `[TeamTournament] Executing round ${tournament.currentRound} of ${tournament.name} | ` +
    `${pendingMatches.length} pending matches`,
  );

  let matchesExecuted = 0;
  let matchesFailed = 0;
  let matchesForfeited = 0;
  let matchesResumed = 0;
  let matchesCancelled = 0;
  const mode = tournament.participantType === 'team_2v2' ? 'tournament_2v2' as const : 'tournament_3v3' as const;

  // 3. Execute each match
  for (const match of pendingMatches) {
    try {
      if (match.isByeMatch) {
        const advancingParticipantId = match.participant1Id ?? match.participant2Id;
        if (advancingParticipantId === null) {
          throw new TournamentError(
            TournamentErrorCode.MATCH_MISSING_ROBOTS,
            `Team tournament bye ${match.id} missing advancing team`,
            400,
            { matchId: match.id },
          );
        }

        const resolved = await completeByeMatch(match, advancingParticipantId);
        if (!resolved) {
          throw new TournamentError(
            TournamentErrorCode.INVALID_MATCH_STATE,
            `Team tournament bye ${match.id} did not produce a Bye_Record`,
            400,
            { matchId: match.id },
          );
        }
        matchesExecuted++;
        continue;
      }

      // 1. Resume first: a linked fought battle is finalised, never forfeited,
      // so the forfeit claim (battleId: null) can never strand its row.
      if (match.battleId !== null) {
        await processTeamTournamentBattle(match, tournament);
        matchesResumed++;
        continue;
      }

      // 2. One per-side entry decision: roster/subscriptions and weapons.
      const entry = await decideTeamTournamentEntry(match, tournament);
      if (entry.kind === 'forfeit') {
        matchesForfeited++;
        continue;
      }
      if (entry.kind === 'housekeeping') {
        matchesExecuted++;
        continue;
      }

      // 3. Battle (its own readiness backstop may still forfeit).
      const battle = await processTeamTournamentBattle(match, tournament);
      if (battle.isForfeit) {
        matchesForfeited++;
      } else {
        matchesExecuted++;
      }
    } catch (error) {
      // Rule 7: one bad match never fails the round. Resume a linked fought
      // battle once; otherwise the shared failure policy finalises the row.
      matchesFailed++;
      const recovery = await recoverTournamentMatch({
        mode,
        matchId: match.id,
        error,
        resume: (row) => processTeamTournamentBattle(row, tournament),
      });
      if (recovery.outcome === 'resumed') {
        matchesResumed++;
      } else {
        matchesCancelled++;
      }
    }
  }

  logger.info(
    `[TeamTournament] Round ${tournament.currentRound} complete | ` +
    `tournament=${tournament.name} executed=${matchesExecuted} forfeited=${matchesForfeited} ` +
    `resumed=${matchesResumed} failed=${matchesFailed}`,
  );

  return { matchesExecuted, matchesFailed, matchesForfeited, matchesResumed, matchesCancelled };
}

// ─── Draw Tiebreaking (R4.4) ─────────────────────────────────────────────────

export interface DrawResolution {
  winningSide: 1 | 2;
  winningTeamId: number;
}

/**
 * Resolve a draw in a team tournament match.
 *
 * If the battle result is not a draw, returns the natural winner.
 * If it IS a draw:
 *   1. Compare total remaining HP across teams
 *   2. Higher total HP wins
 *   3. If equal: participant1 wins (higher seed = lower bracket position)
 *
 * Tournament matches NEVER end in a draw after tiebreaking.
 *
 * @param battleResult - Result from simulateTeamBattle
 * @param team1Id - Team 1 participant ID
 * @param team2Id - Team 2 participant ID
 * @returns Resolved winner side and team ID
 */
export function resolveDraw(
  battleResult: TeamBattleResult,
  team1Id: number,
  team2Id: number,
): DrawResolution {
  // If not a draw, return natural winner
  if (!battleResult.isDraw && battleResult.winningSide !== null) {
    return {
      winningSide: battleResult.winningSide,
      winningTeamId: battleResult.winningSide === 1 ? team1Id : team2Id,
    };
  }

  // Draw tiebreaking: compare total remaining HP
  const team1TotalHP = battleResult.participants
    .filter(p => p.team === 1)
    .reduce((sum, p) => sum + p.finalHP, 0);

  const team2TotalHP = battleResult.participants
    .filter(p => p.team === 2)
    .reduce((sum, p) => sum + p.finalHP, 0);

  if (team1TotalHP > team2TotalHP) {
    return { winningSide: 1, winningTeamId: team1Id };
  } else if (team2TotalHP > team1TotalHP) {
    return { winningSide: 2, winningTeamId: team2Id };
  }

  // Equal HP: participant1 wins (higher seed = lower bracket position)
  return { winningSide: 1, winningTeamId: team1Id };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Build the TeamBattleLog JSON structure for Battle.battleLog in tournament context.
 */
function buildTeamTournamentBattleLog(
  result: TeamBattleResult,
  teamSize: 2 | 3,
  tournament: Tournament,
): TeamBattleLog & { isTournament: boolean; round: number; maxRounds: number; isFinals: boolean } {
  return {
    ...buildTeamBattleLog(result, teamSize),
    // Tournament-specific metadata
    isTournament: true,
    round: tournament.currentRound,
    maxRounds: tournament.maxRounds,
    isFinals: tournament.currentRound === tournament.maxRounds,
  };
}
