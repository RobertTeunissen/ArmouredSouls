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
 * Requirements: R4.1, R4.2, R4.3, R4.5, R4.6, R5.5, R5.6
 *
 * @module services/tournament/teamTournamentBattleOrchestrator
 */

import { Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import { BATTLE_LOG_OMIT, encodeBattleLog } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import { countKillsByRobot } from '../../shared/utils/battleStatistics';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { simulateTeamBattle } from '../team-battle/teamBattleEngine';
import { calculateTeamBattleELOChanges, distributeTeamCredits } from '../team-battle/teamBattleRewardService';
import { TeamBattleResult, TeamBattleLog } from '../../types/teamBattleLogTypes';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import {
  calculateTournamentWinReward,
  calculateTournamentParticipationReward,
  calculateTournamentFame,
} from '../../utils/tournamentRewards';
import { applyTeamCreditPoolFactor } from '../../utils/economyFormulas';
import {
  awardStreamingRevenueForParticipant,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  updateRobotCombatStats,
} from '../battle/battlePostCombat';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { completeByeMatch, resolveHigherSeed } from './tournamentService';
import { recoverTournamentMatch } from '../battle/matchFailurePolicy';
import {
  applyLoadoutFallbacks,
  evaluateCombatEntry,
  evaluateMatchEntry,
} from '../battle/combatReadiness';
import { resolveForfeitEvent, type ForfeitSide } from '../battle/forfeitResolutionService';
import { BYE_BATTLE_DURATION_SECONDS } from '../battle/byeResolutionService';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';

// ─── Team Tournament Prestige (Stepped Curve) ────────────────────────────────

/**
 * Stepped prestige curve for team tournament wins.
 * Index = round number (1-based). Capped at 60 for rounds 5+.
 */
const TOURNAMENT_PRESTIGE_STEPPED = [0, 20, 30, 40, 50, 60]; // Index 0 unused

/** Championship bonus prestige for winning the final round */
const TOURNAMENT_CHAMPIONSHIP_BONUS = 150;

/**
 * Owner credit pools for one team tournament battle (#527).
 *
 * Each arm is the round's solo amount (`calculateTournamentWinReward` for the
 * winner, `calculateTournamentParticipationReward` for the loser) × teamSize,
 * then the Team_Credit_Pool_Factor (0.75) once, rounded once. The pools are
 * owner totals: split them with `distributeTeamCredits`, never multiply them by
 * teamSize again (the pre-Spec #49 N² payment).
 */
export function calculateTeamTournamentCreditPools(
  totalParticipants: number,
  currentRound: number,
  maxRounds: number,
  teamSize: 2 | 3,
): { winnerPool: number; loserPool: number } {
  return {
    winnerPool: applyTeamCreditPoolFactor(
      calculateTournamentWinReward(totalParticipants, currentRound, maxRounds) * teamSize,
    ),
    loserPool: applyTeamCreditPoolFactor(
      calculateTournamentParticipationReward(totalParticipants, currentRound, maxRounds) * teamSize,
    ),
  };
}

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
  /** The team advancing in the bracket (the higher seed on a double forfeit). */
  winnerId: number;
  participants: TeamBattleParticipantResult[];
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

interface TeamTournamentAchievementParticipant {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  finalHP: number;
  eloBefore: number;
  eloAfter: number;
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
  for (const robotId of applyLoadoutFallbacks([...team1Robots, ...team2Robots], entry.decisions)) {
    const decision = entry.decisions.find(d => d.robotId === robotId);
    logger.warn('[Battle] Loadout fallback', {
      matchId: match.id,
      robotId,
      storedLoadout: decision?.loadoutFallback?.storedLoadout,
      battleLoadout: 'single',
    });
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

  const winnerFame = await calculateTeamTournamentFameAward(
    tournament,
    winningSide,
    team1Robots,
    team2Robots,
    battleResult,
  );

  // Per-robot destruction credit. The previous expression gave a destroyed
  // robot no credit at all — even when it wrecked an opponent before dying —
  // and gave every surviving teammate credit for one shared destruction.
  const killsByRobot = countKillsByRobot(
    (battleResult.detailedCombatEvents || []) as unknown as Parameters<typeof countKillsByRobot>[0],
  );

  // Update robot combat stats via shared helper (HP, ELO, counters, damage lifetime)
  for (const robot of team1Robots) {
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    await updateRobotCombatStats({
      robotId: robot.id,
      finalHP: Math.round(participant?.finalHP ?? robot.currentHP),
      combatMaxHP: robot.maxHP,
      newELO: robot.elo + eloChanges.team1Change,
      isWinner: winningSide === 1,
      isDraw,
      damageDealt: Math.round(participant?.damageDealt ?? 0),
      damageTakenByOpponent: Math.round(
        battleResult.participants
          .filter(p => p.team === 2)
          .reduce((sum, p) => sum + p.damageDealt, 0) / teamSize
      ),
      opponentsDestroyed: killsByRobot[robot.name] ?? 0,
      fameIncrement: winningSide === 1 ? winnerFame : 0,
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
      combatMaxHP: robot.maxHP,
      newELO: robot.elo + eloChanges.team2Change,
      isWinner: winningSide === 2,
      isDraw,
      damageDealt: Math.round(participant?.damageDealt ?? 0),
      damageTakenByOpponent: Math.round(
        battleResult.participants
          .filter(p => p.team === 1)
          .reduce((sum, p) => sum + p.damageDealt, 0) / teamSize
      ),
      opponentsDestroyed: killsByRobot[robot.name] ?? 0,
      fameIncrement: winningSide === 2 ? winnerFame : 0,
      battleType: `tournament_${teamSize}v${teamSize}`,
      stance: robot.stance,
      loadoutType: robot.loadoutType,
    });
  }

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
    isForfeit: false,
  };
}

async function resumeTeamTournamentBattleFinalization(
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

async function awardTeamTournamentBattleAchievements(
  battleId: number,
  battleType: 'tournament_2v2' | 'tournament_3v3',
  winningSide: 1 | 2,
  team1: { stableId: number },
  team2: { stableId: number },
  participants: TeamTournamentAchievementParticipant[],
  battleDurationSeconds: number,
): Promise<void> {
  const team1OpponentElo = participants
    .filter((participant) => participant.team === 2)
    .reduce((sum, participant) => sum + participant.eloBefore, 0);
  const team2OpponentElo = participants
    .filter((participant) => participant.team === 1)
    .reduce((sum, participant) => sum + participant.eloBefore, 0);

  await Promise.all(participants.map(async (participant) => {
    const stableId = participant.team === 1 ? team1.stableId : team2.stableId;
    const previousBattleLost = await didRobotLosePreviousBattle(participant.robotId, battleId);
    await checkAndAwardAchievements(stableId, participant.robotId, {
      won: winningSide === participant.team,
      destroyed: participant.finalHP === 0,
      finalHpPercent: 0,
      eloChange: participant.eloAfter - participant.eloBefore,
      opponentElo: participant.team === 1 ? team1OpponentElo : team2OpponentElo,
      yielded: false,
      opponentYielded: false,
      previousBattleLost,
      damageDealt: participant.damageDealt,
      opponentDamageDealt: 0,
      loadoutType: 'single',
      stance: 'balanced',
      yieldThreshold: 0,
      hasTuning: false,
      hasMainWeapon: true,
      battleType,
      battleDurationSeconds,
    });
  }));
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

// ─── Battle-Time Entry and Forfeits ──────────────────────────────────────────

/** One side of a team tournament match as loaded for the entry decision. */
interface TeamTournamentEntrySide {
  /** Bracket participant id (team id), or null for an empty slot. */
  participantId: number | null;
  /** Null when the slot is empty or the team row no longer exists. */
  team: { id: number; stableId: number; teamName: string } | null;
  /** Loaded members; may be short (or empty) only for a forfeiting side. */
  robots: RobotWithWeapons[];
  forfeited: boolean;
}

/** Outcome of `decideTeamTournamentEntry`. */
export type TeamTournamentEntryResult =
  | { kind: 'fight' }
  | { kind: 'forfeit'; result: TeamTournamentBattleResult }
  | { kind: 'housekeeping' };

/**
 * Check if a team is eligible for tournament participation at execution time.
 * A team is eligible if it has a full roster and all members have active
 * subscriptions to the relevant tournament event.
 *
 * @param teamId - The team's ID to check
 * @returns true if the team is eligible, false otherwise
 */
async function isTeamEligibleForTournament(teamId: number): Promise<boolean> {
  const team = await prisma.teamBattle.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.members.length !== team.teamSize) return false;

  const eventType = team.teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3';
  const robotIds = team.members.map(m => m.robotId);
  const subscribed = await prisma.subscription.count({
    where: { eventType, robotId: { in: robotIds }, status: 'active' },
  });
  return subscribed === team.members.length;
}

async function loadEntrySide(participantId: number | null): Promise<TeamTournamentEntrySide> {
  const team = participantId === null
    ? null
    : await prisma.teamBattle.findUnique({ where: { id: participantId }, include: { members: true } });
  const rosterEligible = team !== null && (await isTeamEligibleForTournament(team.id));
  const robots = team ? await loadTeamRobotsWithWeapons(team.members.map(m => m.robotId)) : [];
  const weaponReady = robots.length > 0 && robots.every(r => evaluateCombatEntry(r).canFight);
  return {
    participantId,
    team: team ? { id: team.id, stableId: team.stableId, teamName: team.teamName } : null,
    robots,
    forfeited: !rosterEligible || !weaponReady,
  };
}

/** Empty placeholder (or both teams gone): close the row with no battle. */
async function completeEmptyMatch(match: ScheduledTournamentMatch): Promise<void> {
  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: { status: 'completed', winnerId: null, completedAt: new Date() },
  });
  logger.info(`[TeamTournament] Match ${match.id} closed with no battle | no loadable team on either side`);
}

/**
 * One per-side battle-time entry decision for both sides (design §5.5, rule 2).
 *
 * A side forfeits if its team is roster/subscription-ineligible OR any loaded
 * member has no main weapon. Neither → fight. One → that side forfeits through
 * the shared writer and the other advances with the bye-level reward. Both →
 * a double forfeit (a draw battle, no credits) where the higher seed among the
 * sides whose team still exists advances. No loadable team at all (or an empty
 * placeholder) → housekeeping with no battle.
 */
export async function decideTeamTournamentEntry(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
): Promise<TeamTournamentEntryResult> {
  if (match.participant1Id === null && match.participant2Id === null) {
    await completeEmptyMatch(match);
    return { kind: 'housekeeping' };
  }

  const side1 = await loadEntrySide(match.participant1Id);
  const side2 = await loadEntrySide(match.participant2Id);
  if (!side1.forfeited && !side2.forfeited) return { kind: 'fight' };
  if (side1.team === null && side2.team === null) {
    await completeEmptyMatch(match);
    return { kind: 'housekeeping' };
  }

  return { kind: 'forfeit', result: await resolveTeamTournamentForfeit(match, tournament, [side1, side2]) };
}

/**
 * Resolve a team tournament forfeit through the Forfeit_Resolution_Writer.
 *
 * Nothing is simulated and no standings are written. ELO follows design §4:
 * a short or missing forfeiter roster counts as equal strength; a double
 * forfeit uses the draw formula (an incomplete side takes the full side's sum;
 * neither full → unchanged). Each loaded robot moves by its team's change.
 */
async function resolveTeamTournamentForfeit(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
  sides: [TeamTournamentEntrySide, TeamTournamentEntrySide],
): Promise<TeamTournamentBattleResult> {
  const teamSize: 2 | 3 = tournament.participantType === 'team_2v2' ? 2 : 3;
  const mode = teamSize === 2 ? 'tournament_2v2' as const : 'tournament_3v3' as const;
  const readyIndex = sides.findIndex(s => !s.forfeited);
  const ready = readyIndex === -1 ? null : sides[readyIndex];
  const isDraw = ready === null;

  const sum = (s: TeamTournamentEntrySide): number => s.robots.reduce((acc, r) => acc + r.elo, 0);
  const full = (s: TeamTournamentEntrySide): boolean => s.robots.length === teamSize;
  let changes = { team1Change: 0, team2Change: 0 };
  if (ready) {
    const forfeiter = sides[1 - readyIndex];
    const forfeiterSum = full(forfeiter) ? sum(forfeiter) : sum(ready);
    const [sum1, sum2] = readyIndex === 0 ? [sum(ready), forfeiterSum] : [forfeiterSum, sum(ready)];
    changes = calculateTeamBattleELOChanges(sum1, sum2, readyIndex === 0, false);
  } else if (full(sides[0]) || full(sides[1])) {
    const sum1 = full(sides[0]) ? sum(sides[0]) : sum(sides[1]);
    const sum2 = full(sides[1]) ? sum(sides[1]) : sum(sides[0]);
    changes = calculateTeamBattleELOChanges(sum1, sum2, false, true);
  }
  const teamChange = (side: 0 | 1): number => (side === 0 ? changes.team1Change : changes.team2Change);

  // The team advancing in the bracket: the ready team, or on a double forfeit
  // the higher seed among the sides whose team row still exists.
  let tournamentWinnerId: number;
  if (ready) {
    tournamentWinnerId = ready.team!.id;
  } else if (sides[0].team && sides[1].team) {
    tournamentWinnerId = await resolveHigherSeed(tournament.id, sides[0].team.id, sides[1].team.id);
  } else {
    const existing = sides[0].team ?? sides[1].team;
    if (!existing) {
      throw new TournamentError(
        TournamentErrorCode.INVALID_MATCH_STATE,
        `Team tournament match ${match.id} has no team to advance`,
        400,
        { matchId: match.id },
      );
    }
    tournamentWinnerId = existing.id;
  }

  const newEloByRobotId: Record<number, number> = {};
  sides.forEach((s, i) => {
    for (const r of s.robots) newEloByRobotId[r.id] = r.elo + teamChange(i as 0 | 1);
  });
  const toParticipant = (r: RobotWithWeapons) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    currentHP: r.currentHP,
    maxHP: r.maxHP,
    elo: r.elo,
  });
  // Tolerant sides (§4): a deleted team has no stable and no robots.
  const toForfeitSide = (i: 0 | 1): ForfeitSide => ({
    side: (i + 1) as 1 | 2,
    forfeited: sides[i].forfeited,
    stableUserId: sides[i].team?.stableId ?? null,
    standingEntity: null,
    robots: sides[i].robots.map(toParticipant),
  });
  const forfeiterNames = sides
    .filter(s => s.forfeited)
    .map(s => s.team?.teamName ?? `Team #${s.participantId ?? '?'}`)
    .join(' and ');

  const resolution = await resolveForfeitEvent({
    mode,
    context: {
      mode,
      totalParticipants: tournament.totalParticipants,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
    },
    claim: { source: 'tournament_match', tournamentMatchId: match.id },
    sides: [toForfeitSide(0), toForfeitSide(1)],
    newEloByRobotId,
    eloChangeBySide: { 1: changes.team1Change, 2: changes.team2Change },
    lp: { win: 0, loss: 0, draw: 0 },
    standingMode: null,
    battle: {
      battleType: mode,
      leagueType: 'tournament',
      tournamentId: tournament.id,
      tournamentRound: tournament.currentRound,
      winnerId: ready ? ready.team!.id : null,
      winningSide: ready ? ((readyIndex + 1) as 1 | 2) : null,
      message: `${forfeiterNames} forfeited: the team was not battle-ready (roster, subscriptions or a missing main weapon)`,
    },
    tournamentWinnerId,
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[TeamTournament] Match ${match.id} forfeit | tournament=${tournament.name} round=${tournament.currentRound} ` +
    `team1=${match.participant1Id} team2=${match.participant2Id} ` +
    `outcome=${isDraw ? 'double_forfeit' : readyIndex === 0 ? 'team2_forfeit' : 'team1_forfeit'} ` +
    `advancing=${tournamentWinnerId} credits=${resolution.creditsPaid}${resolution.alreadyResolved ? ' already_resolved' : ''}`,
  );

  if (resolution.battleId === null) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Forfeit resolution produced no battle for team tournament match ${match.id}`,
      500,
      { matchId: match.id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: tournamentWinnerId,
    participants: sides.flatMap((s, i) => s.robots.map((r) => ({
      robotId: r.id,
      team: (i + 1) as 1 | 2,
      damageDealt: 0,
      finalHP: r.currentHP,
      eloBefore: r.elo,
      eloAfter: newEloByRobotId[r.id],
    }))),
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    isByeMatch: false,
    isForfeit: true,
  };
}

// ─── Reward Distribution ─────────────────────────────────────────────────────

/**
 * Distribute rewards for a team tournament battle.
 *
 * Credits: owner pools from `calculateTeamTournamentCreditPools` (round win /
 *   participation reward × teamSize × 0.75, #527), split per robot
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
  // The teamSize factor and the Team_Credit_Pool_Factor are each applied
  // exactly ONCE, in `calculateTeamTournamentCreditPools`, on each arm (Spec #49,
  // #527). These are owner totals; the per-robot split follows below and does
  // not multiply again.
  //
  // Before Spec #49 these were named `...CreditPerRobot`, already carried a
  // `× teamSize`, and were then multiplied by `teamSize` a second time at the
  // award call — so an owner was paid `base × teamSize²`, i.e. 9× instead of 3×
  // for a 3v3. Both arms were affected.
  const { winnerPool: winnerOwnerTotal, loserPool: loserOwnerTotal } = calculateTeamTournamentCreditPools(
    totalParticipants,
    currentRound,
    maxRounds,
    teamSize,
  );

  // Per-robot shares, remainder distributed one credit at a time so the
  // participant rows and financial pairs sum exactly to the former owner total.
  // Each robot is an independently idempotent economic recipient: two teams from
  // the same stable may validly face one another in a tournament.
  const winnerShares = distributeTeamCredits(
    winnerOwnerTotal,
    winnerRobots.map(r => ({ robotId: r.id })),
  );
  const loserShares = distributeTeamCredits(
    loserOwnerTotal,
    loserRobots.map(r => ({ robotId: r.id })),
  );

  const cycleNumber = await getCurrentCycleNumber();
  const tournamentMode = teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3';
  for (const share of winnerShares) {
    const robot = winnerRobots.find(candidate => candidate.id === share.robotId);
    if (!robot) {
      throw new TournamentError(
        TournamentErrorCode.BATTLE_RECORD_FAILED,
        `Winner robot ${share.robotId} is missing from tournament battle ${battleId}`,
        500,
        { battleId, robotId: share.robotId },
      );
    }
    await awardCreditsWithLedger(
      winnerOwnerId,
      share.credits,
      'battle_income',
      cycleNumber,
      'Team tournament reward',
      robot.id,
      { battleId, teamSize },
      {
        battleId,
        mode: tournamentMode,
        tier: currentRound,
        outcome: 'win',
        participationFloor: share.credits,
        winComponent: 0,
        teamSize,
        isBye: false,
      },
    );
  }
  for (const share of loserShares) {
    const robot = loserRobots.find(candidate => candidate.id === share.robotId);
    if (!robot) {
      throw new TournamentError(
        TournamentErrorCode.BATTLE_RECORD_FAILED,
        `Loser robot ${share.robotId} is missing from tournament battle ${battleId}`,
        500,
        { battleId, robotId: share.robotId },
      );
    }
    await awardCreditsWithLedger(
      loserOwnerId,
      share.credits,
      'battle_income',
      cycleNumber,
      'Team tournament reward',
      robot.id,
      { battleId, teamSize },
      {
        battleId,
        mode: tournamentMode,
        tier: currentRound,
        outcome: 'loss',
        participationFloor: share.credits,
        winComponent: 0,
        teamSize,
        isBye: false,
      },
    );
  }

  // ─── Prestige (Stepped Curve — winner only) ────────────────────────
  const winnerPrestige = calculateTeamTournamentPrestige(currentRound, maxRounds);
  // Losers earn ZERO prestige
  await awardPrestigeToUser(winnerOwnerId, winnerPrestige * teamSize, cycleNumber, {
    source: 'battle',
    mode: tournamentMode,
    battleId,
  });

  // ─── Fame (winner only) ────────────────────────────────────────────
  // Fame is applied with the non-repeatable combat-stat mutation before the
  // battleId checkpoint. Finalization only records the already-earned amount.
  const winnerFame = await calculateTeamTournamentFameAward(
    tournament,
    winningSide,
    team1Robots,
    team2Robots,
    battleResult,
  );

  // ─── Streaming Revenue (all participants) ──────────────────────────
  for (const robot of winnerRobots) {
    await awardStreamingRevenueForParticipant(robot.id, winnerOwnerId, battleId, false, teamSize, tournamentMode);
  }
  for (const robot of loserRobots) {
    await awardStreamingRevenueForParticipant(robot.id, loserOwnerId, battleId, false, teamSize, tournamentMode);
  }

  // ─── Update BattleParticipant records with correct reward amounts ──
  // Per-robot credits come from the share arrays, so they sum exactly to the
  // owner total rather than each carrying the whole amount.
  for (const robot of winnerRobots) {
    await prisma.battleParticipant.update({
      where: { battleId_robotId: { battleId, robotId: robot.id } },
      data: {
        credits: winnerShares.find(s => s.robotId === robot.id)?.credits ?? 0,
        prestigeAwarded: winnerPrestige,
        fameAwarded: winnerFame,
      },
    });
  }
  for (const robot of loserRobots) {
    await prisma.battleParticipant.update({
      where: { battleId_robotId: { battleId, robotId: robot.id } },
      data: {
        credits: loserShares.find(s => s.robotId === robot.id)?.credits ?? 0,
        prestigeAwarded: 0,
        fameAwarded: 0,
      },
    });
  }

  // ─── Update Battle record with reward amounts ──────────────────────
  // These are per-OWNER totals. The stored number is unchanged from before
  // Spec #49 (it was always `base × teamSize`), but its meaning shifted: the
  // owner is now paid exactly this, rather than `teamSize ×` this.
  await prisma.battle.update({
    where: { id: battleId },
    data: {
      winnerReward: winnerOwnerTotal,
      loserReward: loserOwnerTotal,
    },
  });

  return { winnerReward: winnerOwnerTotal, loserReward: loserOwnerTotal, winnerPrestige, winnerFame };
}

async function calculateTeamTournamentFameAward(
  tournament: Tournament,
  winningSide: 1 | 2,
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  battleResult: TeamBattleResult,
): Promise<number> {
  const currentRoundMatches = await prisma.scheduledTournamentMatch.findMany({
    where: { tournamentId: tournament.id, round: tournament.currentRound },
  });
  const regularMatchCount = currentRoundMatches.filter(match => !match.isByeMatch).length;
  const byeMatchCount = currentRoundMatches.filter(match => match.isByeMatch).length;
  const teamsRemaining = (regularMatchCount * 2) + byeMatchCount;
  const winnerParticipants = battleResult.participants.filter(participant => participant.team === winningSide);
  const winnerTotalHP = winnerParticipants.reduce((sum, participant) => sum + participant.finalHP, 0);
  const winnerRobots = winningSide === 1 ? team1Robots : team2Robots;
  const winnerMaxHP = winnerRobots.reduce((sum, robot) => sum + robot.maxHP, 0);

  return calculateTournamentFame(
    tournament.totalParticipants,
    teamsRemaining,
    winnerTotalHP,
    winnerMaxHP,
  );
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
