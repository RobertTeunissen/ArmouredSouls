/**
 * Team Tournament Battle Orchestrator
 *
 * Handles team tournament match execution by dispatching to the Team Battle Engine.
 * Creates Battle + BattleParticipant records, updates match status, and handles
 * draw tiebreaking (Task 5.2), reward distribution (Task 5.3), and forfeit
 * handling with eligibility checks (Task 5.4).
 *
 * This module implements the core match execution flow:
 *   load teams → prepare → simulate → create battle record → update match
 *
 * Requirements: R4.1, R4.2, R4.3, R4.5, R4.6, R5.5, R5.6
 *
 * @module services/tournament/teamTournamentBattleOrchestrator
 */

import { Tournament, ScheduledTournamentMatch, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { simulateTeamBattle } from '../team-battle/teamBattleEngine';
import { calculateTeamBattleELOChanges } from '../team-battle/teamBattleRewardService';
import { TeamBattleResult, TeamBattleLog } from '../../types/teamBattleLogTypes';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import {
  calculateTournamentWinReward,
  calculateTournamentParticipationReward,
  calculateTournamentFame,
} from '../../utils/tournamentRewards';
import {
  awardStreamingRevenueForParticipant,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  awardFameToRobot,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  updateRobotCombatStats,
} from '../battle/battlePostCombat';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';

// ─── Team Tournament Prestige (Stepped Curve) ────────────────────────────────

/**
 * Stepped prestige curve for team tournament wins.
 * Index = round number (1-based). Capped at 60 for rounds 5+.
 */
const TOURNAMENT_PRESTIGE_STEPPED = [0, 20, 30, 40, 50, 60]; // Index 0 unused

/** Championship bonus prestige for winning the final round */
const TOURNAMENT_CHAMPIONSHIP_BONUS = 150;

/**
 * Calculate prestige for a team tournament match winner using the stepped curve.
 *
 * Formula:
 * - R1=20, R2=30, R3=40, R4=50, R5+=60 (capped at 60)
 * - Championship bonus: +150 for winning the final round
 * - Losers earn ZERO prestige (handled by caller)
 *
 * @param currentRound - The current round number (1-based)
 * @param maxRounds - Total rounds in the tournament
 * @returns Prestige amount for the winning team's robots
 */
export function calculateTeamTournamentPrestige(currentRound: number, maxRounds: number): number {
  const basePrestige = currentRound <= 5
    ? (TOURNAMENT_PRESTIGE_STEPPED[currentRound] ?? 60)
    : 60; // Capped at 60 for rounds 5+
  const isFinals = currentRound === maxRounds;
  return basePrestige + (isFinals ? TOURNAMENT_CHAMPIONSHIP_BONUS : 0);
}

// ─── Public Interfaces ───────────────────────────────────────────────────────

export interface TeamBattleParticipantResult {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  finalHP: number;
  eloBefore: number;
  eloAfter: number;
}

export interface TeamTournamentBattleResult {
  battleId: number;
  winnerId: number; // Winning team ID
  participants: TeamBattleParticipantResult[];
  durationSeconds: number;
  isByeMatch: boolean;
}

export interface RoundExecutionResult {
  matchesExecuted: number;
  matchesFailed: number;
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

  const team1Robots = await loadTeamRobotsWithWeapons(team1RobotIds);
  const team2Robots = await loadTeamRobotsWithWeapons(team2RobotIds);

  if (team1Robots.length !== teamSize || team2Robots.length !== teamSize) {
    throw new TournamentError(
      TournamentErrorCode.MATCH_MISSING_ROBOTS,
      `Team composition mismatch for match ${match.id}: team1=${team1Robots.length}, team2=${team2Robots.length}, expected=${teamSize}`,
      400,
      { matchId: match.id, team1Count: team1Robots.length, team2Count: team2Robots.length, teamSize },
    );
  }

  // 3. Prepare all 2N robots for combat (full HP, shield, tuning bonuses)
  const allRobotIds = [...team1RobotIds, ...team2RobotIds];
  const tuningMap = await getTuningBonusesBatch(allRobotIds);

  for (const robot of team1Robots) {
    prepareRobotForCombat(robot, tuningMap.get(robot.id) ?? {});
  }
  for (const robot of team2Robots) {
    prepareRobotForCombat(robot, tuningMap.get(robot.id) ?? {});
  }

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
      battleType,
      leagueType: 'tournament',
      tournamentId: tournament.id,
      tournamentRound: tournament.currentRound,
      durationSeconds: Math.round(battleResult.durationSeconds),
      winnerReward: 0, // Rewards handled in Task 5.3
      loserReward: 0,

      battleLog: buildTeamTournamentBattleLog(battleResult, teamSize, tournament) as unknown as Prisma.InputJsonValue,
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

  // Write pre-computed battle summary (Spec #39)
  await prisma.battle.update({ where: { id: battle.id }, data: { winningSide } }).catch(() => {});
  const allRobots = [...team1Robots, ...team2Robots];
  const robotMaxHP: Record<string, number> = {};
  const robotNameToId: Record<string, number> = {};
  const robotNameToTeam: Record<string, number> = {};
  for (const r of allRobots) {
    robotMaxHP[r.name] = r.maxHP;
    robotNameToId[r.name] = r.id;
    robotNameToTeam[r.name] = battleResult.participants.find(p => p.robotId === r.id)?.team ?? 1;
  }
  const summaryData = computeBattleSummary({
    events: (battleResult.detailedCombatEvents || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: Math.round(battleResult.durationSeconds),
    battleType,
    robotMaxHP,
    robotNameToId,
    robotNameToTeam,
    tagTeamInfo: {
      team1Robots: team1Robots.map(r => r.name),
      team2Robots: team2Robots.map(r => r.name),
    },
    startingPositions: battleResult.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: battleResult.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: battleResult.arenaRadius,
  });
  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[team-tournament] Failed to write battle summary', { battleId: battle.id, error: err instanceof Error ? err.message : String(err) });
    });
  }

  // Update robot combat stats via shared helper (HP, ELO, counters, damage lifetime)
  for (const robot of team1Robots) {
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    await updateRobotCombatStats({
      robotId: robot.id,
      finalHP: Math.round(participant?.finalHP ?? robot.currentHP),
      newELO: robot.elo + eloChanges.team1Change,
      isWinner: winningSide === 1,
      isDraw,
      damageDealt: Math.round(participant?.damageDealt ?? 0),
      damageTakenByOpponent: Math.round(
        battleResult.participants
          .filter(p => p.team === 2)
          .reduce((sum, p) => sum + p.damageDealt, 0) / teamSize
      ),
      opponentDestroyed: (participant?.finalHP ?? 0) === 0 ? false : battleResult.participants.filter(p => p.team === 2).some(p => p.finalHP === 0),
      fameIncrement: 0, // Fame handled in distributeTeamTournamentRewards
      battleType: `tournament_${teamSize}v${teamSize}`,
      stance: robot.stance,
      loadoutType: robot.loadoutType,
    });
  }
  for (const robot of team2Robots) {
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    await updateRobotCombatStats({
      robotId: robot.id,
      finalHP: Math.round(participant?.finalHP ?? robot.currentHP),
      newELO: robot.elo + eloChanges.team2Change,
      isWinner: winningSide === 2,
      isDraw,
      damageDealt: Math.round(participant?.damageDealt ?? 0),
      damageTakenByOpponent: Math.round(
        battleResult.participants
          .filter(p => p.team === 1)
          .reduce((sum, p) => sum + p.damageDealt, 0) / teamSize
      ),
      opponentDestroyed: (participant?.finalHP ?? 0) === 0 ? false : battleResult.participants.filter(p => p.team === 1).some(p => p.finalHP === 0),
      fameIncrement: 0, // Fame handled in distributeTeamTournamentRewards
      battleType: `tournament_${teamSize}v${teamSize}`,
      stance: robot.stance,
      loadoutType: robot.loadoutType,
    });
  }

  // 8. Update match: winnerId (team ID), battleId, status='completed', completedAt
  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: {
      winnerId: winningTeamId,
      battleId: battle.id,
      status: 'completed',
      completedAt: new Date(),
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

  // 10. Check achievements for all participating robots (battle_complete trigger)
  for (const robot of team1Robots) {
    const prevLost = await didRobotLosePreviousBattle(robot.id, battle.id);
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    await checkAndAwardAchievements(team1.stableId, robot.id, {
      won: winningSide === 1,
      destroyed: (participant?.finalHP ?? 0) === 0,
      finalHpPercent: 0,
      eloDiff: eloChanges.team1Change,
      opponentElo: team2SumELO,
      yielded: false,
      opponentYielded: false,
      previousBattleLost: prevLost,
      damageDealt: participant?.damageDealt ?? 0,
      opponentDamageDealt: 0,
      loadoutType: 'single',
      stance: 'balanced',
      yieldThreshold: 0,
      hasTuning: false,
      hasMainWeapon: true,
      battleType,
      battleDurationSeconds: battleResult.durationSeconds,
    });
  }

  for (const robot of team2Robots) {
    const prevLost = await didRobotLosePreviousBattle(robot.id, battle.id);
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    await checkAndAwardAchievements(team2.stableId, robot.id, {
      won: winningSide === 2,
      destroyed: (participant?.finalHP ?? 0) === 0,
      finalHpPercent: 0,
      eloDiff: eloChanges.team2Change,
      opponentElo: team1SumELO,
      yielded: false,
      opponentYielded: false,
      previousBattleLost: prevLost,
      damageDealt: participant?.damageDealt ?? 0,
      opponentDamageDealt: 0,
      loadoutType: 'single',
      stance: 'balanced',
      yieldThreshold: 0,
      hasTuning: false,
      hasMainWeapon: true,
      battleType,
      battleDurationSeconds: battleResult.durationSeconds,
    });
  }

  // Build participant results for return
  const participants: TeamBattleParticipantResult[] = participantRecords.map(p => ({
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
  };
}

// ─── Main Export: Execute Round ──────────────────────────────────────────────

/**
 * Execute all pending matches in the current round of a team tournament.
 *
 * For each pending match:
 * 1. Check forfeit conditions (R5.5, R5.6)
 * 2. Execute battle via processTeamTournamentBattle
 * 3. On failure: log error, skip match, continue remaining
 *
 * @param tournamentId - ID of the tournament to execute
 * @param teamSize - Team size (2 or 3)
 * @returns Execution summary with matches executed and failed counts
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
      isByeMatch: false, // Skip bye matches (already auto-completed)
    },
    orderBy: { matchNumber: 'asc' },
  });

  logger.info(
    `[TeamTournament] Executing round ${tournament.currentRound} of ${tournament.name} | ` +
    `${pendingMatches.length} pending matches`,
  );

  let matchesExecuted = 0;
  let matchesFailed = 0;

  // 3. Execute each match
  for (const match of pendingMatches) {
    try {
      // Check forfeit conditions (R5.5, R5.6)
      const forfeit = await checkForfeitConditions(match);
      if (forfeit.shouldForfeit) {
        await handleForfeit(match, forfeit);
        matchesExecuted++;
        continue;
      }

      // Execute battle
      await processTeamTournamentBattle(match, tournament);
      matchesExecuted++;
    } catch (error) {
      matchesFailed++;
      logger.error(
        `[TeamTournament] Match ${match.id} failed in tournament ${tournament.name}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info(
    `[TeamTournament] Round ${tournament.currentRound} complete | ` +
    `tournament=${tournament.name} executed=${matchesExecuted} failed=${matchesFailed}`,
  );

  return { matchesExecuted, matchesFailed };
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

// ─── Forfeit Handling ─────────────────────────────────────────────────────────

interface ForfeitResult {
  shouldForfeit: boolean;
  winnerId: number | null;
  ineligibleSide?: 1 | 2 | 'both';
}

/**
 * Check if a team is eligible for tournament participation at execution time.
 * A team is eligible if its `eligibility` field is 'ELIGIBLE'.
 *
 * @param teamId - The team's ID to check
 * @returns true if the team is eligible, false otherwise
 */
async function isTeamEligibleForTournament(teamId: number): Promise<boolean> {
  const team = await prisma.teamBattle.findUnique({
    where: { id: teamId },
    select: { eligibility: true },
  });
  return team?.eligibility === 'ELIGIBLE';
}

/**
 * Check if either team should forfeit due to ineligibility.
 *
 * Checks team eligibility at round execution time:
 * - If both participants are null or both ineligible: forfeit with winnerId=null
 * - If only team 1 is ineligible: forfeit, team 2 wins
 * - If only team 2 is ineligible: forfeit, team 1 wins
 * - If both eligible: no forfeit
 *
 * Requirements: R5.5, R5.6
 */
async function checkForfeitConditions(
  match: ScheduledTournamentMatch,
): Promise<ForfeitResult> {
  // Both participants missing — forfeit with no winner
  if (!match.participant1Id && !match.participant2Id) {
    return { shouldForfeit: true, winnerId: null, ineligibleSide: 'both' };
  }

  // Check team 1 eligibility
  const team1Eligible = match.participant1Id
    ? await isTeamEligibleForTournament(match.participant1Id)
    : false;

  // Check team 2 eligibility
  const team2Eligible = match.participant2Id
    ? await isTeamEligibleForTournament(match.participant2Id)
    : false;

  if (!team1Eligible && !team2Eligible) {
    return { shouldForfeit: true, winnerId: null, ineligibleSide: 'both' };
  }
  if (!team1Eligible) {
    return { shouldForfeit: true, winnerId: match.participant2Id, ineligibleSide: 1 };
  }
  if (!team2Eligible) {
    return { shouldForfeit: true, winnerId: match.participant1Id, ineligibleSide: 2 };
  }
  return { shouldForfeit: false, winnerId: null };
}

/**
 * Handle a forfeit by updating the match record with status 'forfeit'.
 *
 * No rewards are distributed for forfeited matches.
 * If winnerId is null (both ineligible), the next-round slot stays empty,
 * triggering a bye for whoever is placed there.
 *
 * Requirements: R5.5, R5.6
 */
async function handleForfeit(
  match: ScheduledTournamentMatch,
  forfeit: ForfeitResult,
): Promise<void> {
  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: {
      winnerId: forfeit.winnerId,
      status: 'forfeit',
      completedAt: new Date(),
    },
  });

  logger.info(
    `[TeamTournament] Match ${match.id} forfeited | ` +
    `ineligible=${forfeit.ineligibleSide} winner=${forfeit.winnerId ?? 'none (both ineligible)'}`,
  );
}

// ─── Reward Distribution ─────────────────────────────────────────────────────

/**
 * Distribute rewards for a team tournament battle.
 *
 * Credits: calculateTournamentWinReward × teamSize per robot (winner), 30% for loser
 * Prestige: Stepped curve (R1=20, R2=30, R3=40, R4=50, R5+=60) + 150 championship bonus (winner only)
 * Fame: calculateTournamentFame with team HP sums (winner only)
 * Streaming: awardStreamingRevenueForParticipant per robot with teamSize
 * ELO: Already applied before this function is called
 *
 * Requirements: R4.7, R6.5, R6.6, R6.7, R6.8, R6.9, R6.10
 */
async function distributeTeamTournamentRewards(
  battleId: number,
  tournament: Tournament,
  winningSide: 1 | 2,
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  team1OwnerId: number,
  team2OwnerId: number,
  battleResult: TeamBattleResult,
  teamSize: 2 | 3,
): Promise<{ winnerReward: number; loserReward: number; winnerPrestige: number; winnerFame: number }> {
  const { totalParticipants, currentRound, maxRounds } = tournament;

  // Determine winner/loser teams
  const winnerRobots = winningSide === 1 ? team1Robots : team2Robots;
  const loserRobots = winningSide === 1 ? team2Robots : team1Robots;
  const winnerOwnerId = winningSide === 1 ? team1OwnerId : team2OwnerId;
  const loserOwnerId = winningSide === 1 ? team2OwnerId : team1OwnerId;

  // ─── Credits ───────────────────────────────────────────────────────
  // Winner per robot: calculateTournamentWinReward × teamSize
  const winnerCreditPerRobot = calculateTournamentWinReward(totalParticipants, currentRound, maxRounds) * teamSize;
  // Loser per robot: 30% of winner (calculateTournamentParticipationReward × teamSize)
  const loserCreditPerRobot = calculateTournamentParticipationReward(totalParticipants, currentRound, maxRounds) * teamSize;

  // Award credits to owners (each robot earns the full amount)
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(winnerOwnerId, winnerCreditPerRobot * teamSize, 'battle_income', cycleNumber, 'Team tournament reward');
  await awardCreditsWithLedger(loserOwnerId, loserCreditPerRobot * teamSize, 'battle_income', cycleNumber, 'Team tournament reward');

  // ─── Prestige (Stepped Curve — winner only) ────────────────────────
  const winnerPrestige = calculateTeamTournamentPrestige(currentRound, maxRounds);
  // Losers earn ZERO prestige
  await awardPrestigeToUser(winnerOwnerId, winnerPrestige * teamSize);

  // ─── Fame (winner only) ────────────────────────────────────────────
  // Calculate teams remaining in current round for exclusivity multiplier
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId: tournament.id, round: currentRound },
  });
  const regularMatchCount = currentRoundMatches.filter(m => !m.isByeMatch).length;
  const byeMatchCount = currentRoundMatches.filter(m => m.isByeMatch).length;
  const teamsRemaining = (regularMatchCount * 2) + byeMatchCount;

  // Sum HP across winning team members for performance bonus
  const winnerParticipants = battleResult.participants.filter(
    p => p.team === winningSide,
  );
  const winnerTotalHP = winnerParticipants.reduce((sum, p) => sum + p.finalHP, 0);
  const winnerMaxHP = winnerRobots.reduce((sum, r) => sum + r.maxHP, 0);

  const winnerFame = calculateTournamentFame(
    totalParticipants,
    teamsRemaining,
    winnerTotalHP,
    winnerMaxHP,
  );

  // Award fame to each winning robot
  for (const robot of winnerRobots) {
    await awardFameToRobot(robot.id, winnerFame);
  }

  // ─── Streaming Revenue (all participants) ──────────────────────────
  for (const robot of winnerRobots) {
    await awardStreamingRevenueForParticipant(robot.id, winnerOwnerId, battleId, false, teamSize);
  }
  for (const robot of loserRobots) {
    await awardStreamingRevenueForParticipant(robot.id, loserOwnerId, battleId, false, teamSize);
  }

  // ─── Update BattleParticipant records with correct reward amounts ──
  for (const robot of winnerRobots) {
    await prisma.battleParticipant.update({
      where: { battleId_robotId: { battleId, robotId: robot.id } },
      data: {
        credits: winnerCreditPerRobot,
        prestigeAwarded: winnerPrestige,
        fameAwarded: winnerFame,
      },
    });
  }
  for (const robot of loserRobots) {
    await prisma.battleParticipant.update({
      where: { battleId_robotId: { battleId, robotId: robot.id } },
      data: {
        credits: loserCreditPerRobot,
        prestigeAwarded: 0,
        fameAwarded: 0,
      },
    });
  }

  // ─── Update Battle record with reward amounts ──────────────────────
  await prisma.battle.update({
    where: { id: battleId },
    data: {
      winnerReward: winnerCreditPerRobot,
      loserReward: loserCreditPerRobot,
    },
  });

  return { winnerReward: winnerCreditPerRobot, loserReward: loserCreditPerRobot, winnerPrestige, winnerFame };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Load robots with their equipped weapons for combat simulation.
 * Includes refinements for prepareRobotForCombat to fold into weapon stats.
 */
async function loadTeamRobotsWithWeapons(robotIds: number[]): Promise<RobotWithWeapons[]> {
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    include: {
      mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
      offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
    },
  });

  return robots as unknown as RobotWithWeapons[];
}

/**
 * Build the TeamBattleLog JSON structure for Battle.battleLog in tournament context.
 */
function buildTeamTournamentBattleLog(
  result: TeamBattleResult,
  teamSize: 2 | 3,
  tournament: Tournament,
): TeamBattleLog & { isTournament: boolean; round: number; maxRounds: number; isFinals: boolean } {
  return {
    teamBattle: true,
    teamSize,
    winningSide: result.winningSide,
    isDraw: result.isDraw,
    isByeMatch: result.isByeMatch,
    durationSeconds: result.durationSeconds,
    participants: result.participants,
    events: result.battleLog,
    detailedCombatEvents: result.detailedCombatEvents,
    focusFireEvents: result.focusFireEvents,
    focusFireMetrics: result.focusFireMetrics,
    allySupportMetrics: result.allySupportMetrics,
    formationDefenceMetrics: result.formationDefenceMetrics,
    arenaRadius: result.arenaRadius,
    startingPositions: result.startingPositions,
    endingPositions: result.endingPositions,
    // Tournament-specific metadata
    isTournament: true,
    round: tournament.currentRound,
    maxRounds: tournament.maxRounds,
    isFinals: tournament.currentRound === tournament.maxRounds,
  };
}
