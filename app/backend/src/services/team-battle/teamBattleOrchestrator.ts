/**
 * Team Battle Orchestrator
 *
 * Executes scheduled 2v2 and 3v3 Team Battle matches. Fetches scheduled matches,
 * loads robot data with weapons, invokes the team battle engine, persists Battle +
 * BattleParticipant rows, distributes rewards, updates team/robot stats, emits
 * audit logs, and handles single-match failures gracefully.
 *
 * Requirements: R1.4, R1.5, R5.5, R5.6, R5.7, R5.8, R7.10, R7.11, R10.4, R10.5, R11.1, R16.2
 *
 * @module services/team-battle/teamBattleOrchestrator
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { simulateTeamBattle } from './teamBattleEngine';
import {
  calculateTeamBattleReward,
  distributeTeamCredits,
  calculateTeamBattleFame,
  calculateTeamBattlePrestige,
  calculateTeamBattleELOChanges,
  calculateTeamBattleLPDelta,
  getByeTeamELO,
} from './teamBattleRewardService';
import { TeamBattleResult, TeamBattleLog } from '../../types/teamBattleLogTypes';
import {
  logBattleAuditEvent,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardStreamingRevenueForParticipant,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
} from '../battle/battlePostCombat';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SingleMatchResult {
  matchId: number;
  status: 'completed' | 'cancelled';
  battleId?: number;
  error?: string;
}

export interface TeamBattleExecutionResult {
  matchesCompleted: number;
  matchesCancelled: number;
  results: SingleMatchResult[];
}

// ─── Scheduled match type with includes ──────────────────────────────────────

type ScheduledMatchWithTeams = Prisma.ScheduledTeamBattleMatchGetPayload<{
  include: {
    team1: { include: { members: { include: { robot: true } }; stable: true } };
    team2: { include: { members: { include: { robot: true } }; stable: true } };
  };
}>;

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Execute all scheduled team battles for a given team size.
 *
 * Fetches scheduled matches, loads robot data with weapons, invokes the
 * team battle engine, persists results, distributes rewards, and emits
 * audit logs. Single-match failures are caught, marked as cancelled,
 * and remaining matches continue (R10.5).
 *
 * @param teamSize - 2 for 2v2 League, 3 for 3v3 League
 * @returns Execution summary with per-match results
 */
export async function executeScheduledTeamBattles(
  teamSize: 2 | 3,
): Promise<TeamBattleExecutionResult> {
  const startTime = Date.now();
  const cycleNumber = await getCurrentCycleNumber();
  const battleType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

  // Fetch all scheduled matches for this team size
  const scheduledMatches = await prisma.scheduledTeamBattleMatch.findMany({
    where: {
      status: 'scheduled',
      teamSize,
    },
    include: {
      team1: { include: { members: { include: { robot: true } }, stable: true } },
      team2: { include: { members: { include: { robot: true } }, stable: true } },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  logger.info(
    `[TeamBattle] Found ${scheduledMatches.length} scheduled ${battleType} matches`,
  );

  const results: SingleMatchResult[] = [];

  for (const match of scheduledMatches) {
    try {
      const result = await executeSingleTeamBattle(
        match as ScheduledMatchWithTeams,
        teamSize,
        battleType,
        cycleNumber,
      );
      results.push(result);
    } catch (error) {
      // R10.5: Mark match as cancelled, log, continue remaining
      await markMatchCancelled(match.id, error);
      results.push({
        matchId: match.id,
        status: 'cancelled',
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error(
        `[TeamBattle] Match ${match.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const matchesCompleted = results.filter(r => r.status === 'completed').length;
  const matchesCancelled = results.filter(r => r.status === 'cancelled').length;
  const durationMs = Date.now() - startTime;

  // R11.1: Structured log line with cycle number, team_size, team IDs, duration, outcome
  logger.info(
    `[TeamBattle] Execution complete | ` +
    `cycle=${cycleNumber} team_size=${teamSize} ` +
    `completed=${matchesCompleted} cancelled=${matchesCancelled} ` +
    `total=${scheduledMatches.length} duration_ms=${durationMs}`,
  );

  return { matchesCompleted, matchesCancelled, results };
}

// ─── Single Match Execution ──────────────────────────────────────────────────

/**
 * Execute a single team battle match end-to-end:
 * 1. Load robots with weapons
 * 2. Prepare robots for combat (tuning bonuses)
 * 3. Simulate the battle
 * 4. Persist Battle + BattleParticipant rows
 * 5. Distribute rewards (credits, fame, prestige, ELO, LP) in a transaction (R7.11)
 * 6. Update team win/loss/draw counters
 * 7. Increment totalLeague2v2Wins / totalLeague3v3Wins on winning robots (R16.2)
 * 8. Emit audit log rows per participating robot (R10.4)
 */
async function executeSingleTeamBattle(
  match: ScheduledMatchWithTeams,
  teamSize: 2 | 3,
  battleType: string,
  cycleNumber: number,
): Promise<SingleMatchResult> {
  const isByeMatch = match.team2Id === null;

  // Load robots with weapons for team 1
  const team1Robots = await loadTeamRobotsWithWeapons(match.team1.members.map(m => m.robotId));

  // Load robots with weapons for team 2 (or create bye robots)
  let team2Robots: RobotWithWeapons[];
  if (isByeMatch) {
    team2Robots = createByeRobots(teamSize);
  } else {
    team2Robots = await loadTeamRobotsWithWeapons(match.team2!.members.map(m => m.robotId));
  }

  // Prepare all robots for combat (apply tuning bonuses)
  const allRealRobotIds = [
    ...team1Robots.map(r => r.id),
    ...(isByeMatch ? [] : team2Robots.map(r => r.id)),
  ];
  const tuningMap = await getTuningBonusesBatch(allRealRobotIds);
  for (const robot of team1Robots) {
    prepareRobotForCombat(robot, tuningMap.get(robot.id) ?? {});
  }
  if (!isByeMatch) {
    for (const robot of team2Robots) {
      prepareRobotForCombat(robot, tuningMap.get(robot.id) ?? {});
    }
  }

  // Simulate the battle
  const battleResult = simulateTeamBattle(team1Robots, team2Robots, teamSize);

  // Determine winning team ID
  const team1Won = battleResult.winningSide === 1;
  const team2Won = battleResult.winningSide === 2;
  const isDraw = battleResult.isDraw;
  const winnerTeamId = team1Won ? match.team1Id : team2Won ? match.team2Id : null;

  // Compute team ELOs for reward calculation
  const team1SumELO = team1Robots.reduce((sum, r) => sum + r.elo, 0);
  const team2SumELO = isByeMatch
    ? getByeTeamELO(teamSize)
    : team2Robots.reduce((sum, r) => sum + r.elo, 0);

  // Calculate ELO changes
  const eloChanges = calculateTeamBattleELOChanges(
    team1SumELO,
    team2SumELO,
    team1Won,
    isDraw,
  );

  // R7.11: Use Prisma interactive transaction for reward distribution
  const battle = await prisma.$transaction(async (tx) => {
    // Create Battle record
    const battleRecord = await tx.battle.create({
      data: {
        robot1Id: team1Robots[0].id,
        robot2Id: isByeMatch ? team1Robots[0].id : team2Robots[0].id,
        winnerId: winnerTeamId,
        battleType,
        leagueType: match.teamBattleLeague,
        leagueInstanceId: match.teamBattleLeagueId,
        durationSeconds: Math.round(battleResult.durationSeconds),
        winnerReward: 0, // Updated below
        loserReward: 0,  // Updated below
        robot1ELOBefore: team1SumELO,
        robot2ELOBefore: team2SumELO,
        robot1ELOAfter: team1SumELO + eloChanges.team1Change,
        robot2ELOAfter: team2SumELO + eloChanges.team2Change,
        eloChange: Math.abs(eloChanges.team1Change),
        battleLog: buildBattleLog(battleResult, teamSize) as unknown as Prisma.InputJsonValue,
      },
    });

    // Persist exactly 2N BattleParticipant rows with correct team values (R1.5)
    // Skip bye robots (negative IDs) — they don't exist in the robots table
    const participantData = battleResult.participants
      .filter(p => p.robotId > 0)
      .map(p => ({
        battleId: battleRecord.id,
        robotId: p.robotId,
        team: p.team,
        role: null as string | null,
        credits: 0,
        streamingRevenue: 0,
        eloBefore: p.team === 1
          ? team1Robots.find(r => r.id === p.robotId)?.elo ?? 0
          : team2Robots.find(r => r.id === p.robotId)?.elo ?? 0,
        eloAfter: 0, // Updated below
        prestigeAwarded: 0,
        fameAwarded: 0,
        damageDealt: Math.round(p.damageDealt),
        finalHP: Math.round(p.finalHP),
        yielded: false,
        destroyed: p.finalHP === 0,
      }));

    await tx.battleParticipant.createMany({ data: participantData });

    // Calculate rewards for both teams
    const team1Reward = calculateTeamBattleReward(
      match.teamBattleLeague, teamSize, team1Won, isDraw,
    );
    const team2Reward = calculateTeamBattleReward(
      match.teamBattleLeague, teamSize, team2Won, isDraw,
    );

    // Distribute credits across team members (R7.4)
    const team1Participants = battleResult.participants.filter(p => p.team === 1);
    const team2Participants = battleResult.participants.filter(p => p.team === 2);
    const team1Credits = distributeTeamCredits(team1Reward, team1Participants);
    const team2Credits = distributeTeamCredits(team2Reward, team2Participants);

    // Award credits to stables
    await awardCreditsToUser(match.team1.stableId, team1Reward);
    if (!isByeMatch && match.team2) {
      await awardCreditsToUser(match.team2.stableId, team2Reward);
    }

    // Calculate fame and prestige
    const fame = calculateTeamBattleFame(match.teamBattleLeague);
    const team1Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team1Won, isDraw);
    const team2Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team2Won, isDraw);

    // Award prestige to stables
    await awardPrestigeToUser(match.team1.stableId, team1Prestige);
    if (!isByeMatch && match.team2) {
      await awardPrestigeToUser(match.team2.stableId, team2Prestige);
    }

    // Calculate LP deltas
    const team1LPDelta = calculateTeamBattleLPDelta(team1Won, isDraw);
    const team2LPDelta = calculateTeamBattleLPDelta(team2Won, isDraw);

    // Update team 1: LP + win/loss/draw counters
    const team1Current = await tx.teamBattle.findUnique({
      where: { id: match.team1Id },
      select: { teamLp: true },
    });
    await tx.teamBattle.update({
      where: { id: match.team1Id },
      data: {
        teamLp: Math.max(0, (team1Current?.teamLp ?? 0) + team1LPDelta),
        totalWins: team1Won ? { increment: 1 } : undefined,
        totalLosses: team2Won ? { increment: 1 } : undefined,
        totalDraws: isDraw ? { increment: 1 } : undefined,
      },
    });

    // Update team 2: LP + win/loss/draw counters (skip for bye)
    if (!isByeMatch && match.team2Id) {
      const team2Current = await tx.teamBattle.findUnique({
        where: { id: match.team2Id },
        select: { teamLp: true },
      });
      await tx.teamBattle.update({
        where: { id: match.team2Id },
        data: {
          teamLp: Math.max(0, (team2Current?.teamLp ?? 0) + team2LPDelta),
          totalWins: team2Won ? { increment: 1 } : undefined,
          totalLosses: team1Won ? { increment: 1 } : undefined,
          totalDraws: isDraw ? { increment: 1 } : undefined,
        },
      });
    }

    // Update individual robot ELOs and team battle win counters (R16.2)
    // Also persist currentHP from battle result so damage carries over to next cycle
    const winField = teamSize === 2 ? 'totalLeague2v2Wins' : 'totalLeague3v3Wins';

    for (const robot of team1Robots) {
      const robotCredits = team1Credits.find(c => c.robotId === robot.id);
      const participant = battleResult.participants.find(p => p.robotId === robot.id);
      await tx.robot.update({
        where: { id: robot.id },
        data: {
          currentHP: Math.round(participant?.finalHP ?? robot.currentHP),
          elo: { increment: eloChanges.team1Change },
          fame: team1Won ? { increment: fame } : undefined,
          [winField]: team1Won ? { increment: 1 } : undefined,
          totalBattles: { increment: 1 },
          wins: team1Won ? { increment: 1 } : undefined,
          draws: isDraw ? { increment: 1 } : undefined,
          losses: (!team1Won && !isDraw) ? { increment: 1 } : undefined,
          kills: (participant?.finalHP === 0) ? undefined : undefined, // kills tracked per opponent
          damageDealtLifetime: { increment: Math.round(participant?.damageDealt ?? 0) },
        },
      });
      // Update BattleParticipant with final values
      await tx.battleParticipant.updateMany({
        where: { battleId: battleRecord.id, robotId: robot.id },
        data: {
          credits: robotCredits?.credits ?? 0,
          eloAfter: robot.elo + eloChanges.team1Change,
          prestigeAwarded: Math.floor(team1Prestige / teamSize),
          fameAwarded: team1Won ? fame : 0,
        },
      });
    }

    if (!isByeMatch) {
      for (const robot of team2Robots) {
        const robotCredits = team2Credits.find(c => c.robotId === robot.id);
        const participant = battleResult.participants.find(p => p.robotId === robot.id);
        await tx.robot.update({
          where: { id: robot.id },
          data: {
            currentHP: Math.round(participant?.finalHP ?? robot.currentHP),
            elo: { increment: eloChanges.team2Change },
            fame: team2Won ? { increment: fame } : undefined,
            [winField]: team2Won ? { increment: 1 } : undefined,
            totalBattles: { increment: 1 },
            wins: team2Won ? { increment: 1 } : undefined,
            draws: isDraw ? { increment: 1 } : undefined,
            losses: (!team2Won && !isDraw) ? { increment: 1 } : undefined,
            damageDealtLifetime: { increment: Math.round(participant?.damageDealt ?? 0) },
          },
        });
        // Update BattleParticipant with final values
        await tx.battleParticipant.updateMany({
          where: { battleId: battleRecord.id, robotId: robot.id },
          data: {
            credits: robotCredits?.credits ?? 0,
            eloAfter: robot.elo + eloChanges.team2Change,
            prestigeAwarded: Math.floor(team2Prestige / teamSize),
            fameAwarded: team2Won ? fame : 0,
          },
        });
      }
    }

    // Update battle record with reward amounts
    await tx.battle.update({
      where: { id: battleRecord.id },
      data: {
        winnerReward: team1Won ? team1Reward : team2Won ? team2Reward : 0,
        loserReward: team1Won ? team2Reward : team2Won ? team1Reward : (isDraw ? team1Reward : 0),
      },
    });

    // Mark match as completed
    await tx.scheduledTeamBattleMatch.update({
      where: { id: match.id },
      data: { status: 'completed' },
    });

    return battleRecord;
  }); // End transaction (R7.11: rollback on failure)

  // ── Post-transaction: streaming revenue + audit logs (non-blocking) ──

  // Award streaming revenue per robot
  for (const robot of team1Robots) {
    await awardStreamingRevenueForParticipant(
      robot.id, match.team1.stableId, battle.id, isByeMatch, teamSize,
    );
  }
  if (!isByeMatch && match.team2) {
    for (const robot of team2Robots) {
      await awardStreamingRevenueForParticipant(
        robot.id, match.team2.stableId, battle.id, false, teamSize,
      );
    }
  }

  // R10.4: Emit audit log rows per participating robot
  // R9.7: Include team_size, outcome, opponent team name, and Team_LP delta in notification extras
  const team1Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team1Won, isDraw);
  const team2Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team2Won, isDraw);
  const fame = calculateTeamBattleFame(match.teamBattleLeague);
  const team1Credits = distributeTeamCredits(
    calculateTeamBattleReward(match.teamBattleLeague, teamSize, team1Won, isDraw),
    battleResult.participants.filter(p => p.team === 1),
  );
  const team2Credits = distributeTeamCredits(
    calculateTeamBattleReward(match.teamBattleLeague, teamSize, team2Won, isDraw),
    battleResult.participants.filter(p => p.team === 2),
  );

  // R9.7: Resolve opponent team names and LP deltas for match notifications
  const team1LPDelta = calculateTeamBattleLPDelta(team1Won, isDraw);
  const team2LPDelta = calculateTeamBattleLPDelta(team2Won, isDraw);
  const team1OpponentName = isByeMatch ? 'Bye' : (match.team2?.teamName ?? 'Unknown');
  const team2OpponentName = match.team1.teamName ?? 'Unknown';

  for (const robot of team1Robots) {
    const participant = battleResult.participants.find(p => p.robotId === robot.id);
    const robotCredits = team1Credits.find(c => c.robotId === robot.id);
    try {
      await logBattleAuditEvent(
        {
          robotId: robot.id,
          userId: match.team1.stableId,
          isWinner: team1Won,
          isDraw,
          damageDealt: participant?.damageDealt ?? 0,
          finalHP: participant?.finalHP ?? 0,
          yielded: false,
          destroyed: (participant?.finalHP ?? 0) === 0,
          credits: robotCredits?.credits ?? 0,
          prestige: Math.floor(team1Prestige / teamSize),
          fame: team1Won ? fame : 0,
          eloBefore: robot.elo,
          eloAfter: robot.elo + eloChanges.team1Change,
        },
        {
          id: battle.id,
          battleType,
          leagueType: match.teamBattleLeague,
          durationSeconds: battleResult.durationSeconds,
          eloChange: Math.abs(eloChanges.team1Change),
        },
        null, // Team battle has no single opponent
        0,    // Streaming revenue tracked separately
        isByeMatch,
        {
          isTeamBattle: true,
          teamSize,
          teamId: match.team1Id,
          opponentTeamId: match.team2Id,
          opponentTeamName: team1OpponentName,
          teamLpDelta: team1LPDelta,
        },
      );
    } catch (auditError) {
      logger.error(
        `[TeamBattle] Audit log failed for robot ${robot.id} in battle #${battle.id}: ` +
        `${auditError instanceof Error ? auditError.message : String(auditError)}`,
      );
    }
  }

  if (!isByeMatch && match.team2) {
    for (const robot of team2Robots) {
      const participant = battleResult.participants.find(p => p.robotId === robot.id);
      const robotCredits = team2Credits.find(c => c.robotId === robot.id);
      try {
        await logBattleAuditEvent(
          {
            robotId: robot.id,
            userId: match.team2.stableId,
            isWinner: team2Won,
            isDraw,
            damageDealt: participant?.damageDealt ?? 0,
            finalHP: participant?.finalHP ?? 0,
            yielded: false,
            destroyed: (participant?.finalHP ?? 0) === 0,
            credits: robotCredits?.credits ?? 0,
            prestige: Math.floor(team2Prestige / teamSize),
            fame: team2Won ? fame : 0,
            eloBefore: robot.elo,
            eloAfter: robot.elo + eloChanges.team2Change,
          },
          {
            id: battle.id,
            battleType,
            leagueType: match.teamBattleLeague,
            durationSeconds: battleResult.durationSeconds,
            eloChange: Math.abs(eloChanges.team2Change),
          },
          null,
          0,
          false,
          {
            isTeamBattle: true,
            teamSize,
            teamId: match.team2Id,
            opponentTeamId: match.team1Id,
            opponentTeamName: team2OpponentName,
            teamLpDelta: team2LPDelta,
          },
        );
      } catch (auditError) {
        logger.error(
          `[TeamBattle] Audit log failed for robot ${robot.id} in battle #${battle.id}: ` +
          `${auditError instanceof Error ? auditError.message : String(auditError)}`,
        );
      }
    }
  }

  // Check and award achievements for all participating robots
  for (const robot of team1Robots) {
    const prevLost = await didRobotLosePreviousBattle(robot.id, battle.id);
    await checkAndAwardAchievements(match.team1.stableId, robot.id, {
      won: team1Won,
      destroyed: (battleResult.participants.find(p => p.robotId === robot.id)?.finalHP ?? 0) === 0,
      finalHpPercent: 0,
      eloDiff: 0,
      opponentElo: 0,
      yielded: false,
      opponentYielded: false,
      previousBattleLost: prevLost,
      damageDealt: battleResult.participants.find(p => p.robotId === robot.id)?.damageDealt ?? 0,
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

  if (!isByeMatch && match.team2) {
    for (const robot of team2Robots) {
      const prevLost = await didRobotLosePreviousBattle(robot.id, battle.id);
      await checkAndAwardAchievements(match.team2.stableId, robot.id, {
        won: team2Won,
        destroyed: (battleResult.participants.find(p => p.robotId === robot.id)?.finalHP ?? 0) === 0,
        finalHpPercent: 0,
        eloDiff: 0,
        opponentElo: 0,
        yielded: false,
        opponentYielded: false,
        previousBattleLost: prevLost,
        damageDealt: battleResult.participants.find(p => p.robotId === robot.id)?.damageDealt ?? 0,
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
  }

  // R11.1: Structured log line per match
  logger.info(
    `[TeamBattle] Match ${match.id} completed | ` +
    `cycle=${cycleNumber} team_size=${teamSize} ` +
    `team1=${match.team1Id} team2=${match.team2Id ?? 'bye'} ` +
    `league=${match.teamBattleLeague} instance=${match.teamBattleLeagueId} ` +
    `duration=${battleResult.durationSeconds.toFixed(1)}s ` +
    `outcome=${isDraw ? 'draw' : team1Won ? 'team1_win' : 'team2_win'}`,
  );

  return { matchId: match.id, status: 'completed', battleId: battle.id };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Load robots with their equipped weapons for combat simulation.
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
 * Create bye robots for a bye-team match.
 * Each bye robot has minimal stats and ELO 1000.
 */
function createByeRobots(teamSize: 2 | 3): RobotWithWeapons[] {
  const robots: RobotWithWeapons[] = [];
  for (let i = 0; i < teamSize; i++) {
    robots.push(createSingleByeRobot(-(i + 1)));
  }
  return robots;
}

/**
 * Create a single bye robot with minimal stats.
 */
function createSingleByeRobot(id: number): RobotWithWeapons {
  const decimal = (val: number) => new Prisma.Decimal(val);
  return {
    id,
    userId: -1,
    name: `Bye Robot ${Math.abs(id)}`,
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    combatPower: decimal(10),
    targetingSystems: decimal(10),
    criticalSystems: decimal(10),
    penetration: decimal(10),
    weaponControl: decimal(10),
    attackSpeed: decimal(10),
    armorPlating: decimal(10),
    shieldCapacity: decimal(10),
    evasionThrusters: decimal(10),
    damageDampeners: decimal(10),
    counterProtocols: decimal(10),
    hullIntegrity: decimal(10),
    servoMotors: decimal(10),
    gyroStabilizers: decimal(10),
    hydraulicSystems: decimal(10),
    powerCore: decimal(10),
    combatAlgorithms: decimal(10),
    threatAnalysis: decimal(10),
    adaptiveAI: decimal(10),
    logicCores: decimal(10),
    syncProtocols: decimal(10),
    supportSystems: decimal(10),
    formationTactics: decimal(10),
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    elo: 1000,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    cyclesInCurrentLeague: 0,
    fame: 0,
    titles: null,
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    totalLeague1v1Wins: 0,
    totalLeague1v1Losses: 0,
    totalLeague1v1Draws: 0,
    totalLeague2v2Wins: 0,
    totalLeague3v3Wins: 0,
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as RobotWithWeapons;
}

/**
 * Build the TeamBattleLog JSON structure for Battle.battleLog.
 */
function buildBattleLog(result: TeamBattleResult, teamSize: 2 | 3): TeamBattleLog {
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
  };
}

/**
 * Mark a scheduled match as cancelled with a reason (R10.5).
 */
async function markMatchCancelled(matchId: number, error: unknown): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  await prisma.scheduledTeamBattleMatch.update({
    where: { id: matchId },
    data: {
      status: 'cancelled',
      cancelReason: reason.slice(0, 500), // Truncate to fit DB column
    },
  });
}
