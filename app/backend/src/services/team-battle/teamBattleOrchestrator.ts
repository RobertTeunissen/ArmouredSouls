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

import { StandingsMode, MatchType, Robot } from '../../../generated/prisma';
import { encodeBattleLog } from '../battle/battleLogCodec';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { evaluateMatchEntry } from '../battle/combatReadiness';
import { applyAndLogLoadoutFallbacks, loadCombatRobots, prepareRobotsWithTuning } from '../battle/battlePreparation';
import { simulateTeamBattle } from './teamBattleEngine';
import { buildTeamBattleLog, updateTeamBattleCombatStats, writeTeamBattleSummary } from './teamBattlePostCombat';
import {
  calculateTeamBattleReward,
  distributeTeamCredits,
  calculateTeamBattleFame,
  calculateTeamBattlePrestige,
  calculateTeamBattleELOChanges,
  calculateTeamBattleLPDelta,
} from './teamBattleRewardService';
import {
  logBattleAuditEvent,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  awardStreamingRevenueForParticipant,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
} from '../battle/battlePostCombat';
import { hasAllocatedTuning, hpPercentOf, lowestHpPercent } from '../battle/battleAchievementContext';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { handleMatchFailure } from '../battle/matchFailurePolicy';
import { runFinancialWriteTransaction } from '../cycle/financialWriteTransaction';
import standingsService from '../standings/standingsService';
import { resolveTeamLeagueBye, resolveTeamLeagueForfeit } from './teamBattleByeAndForfeit';
import { recordCombatBuilds } from '../battle/combatBuildRecorder';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SingleMatchResult {
  matchId: number;
  status: 'completed' | 'forfeit' | 'cancelled';
  battleId?: number;
  error?: string;
}

export interface TeamBattleExecutionResult {
  matchesCompleted: number;
  /** Matches resolved as a battle-time forfeit (single or double); nothing was simulated. */
  matchesForfeited: number;
  matchesCancelled: number;
  results: SingleMatchResult[];
}

// ─── Scheduled match type with includes ──────────────────────────────────────

/** Shape of a scheduled team match as mapped from unified scheduling table with team includes. */
export interface ScheduledMatchWithTeams {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
  scheduledFor: Date;
  status: string;
  cancelReason: string | null;
  createdAt: Date;
  team1: {
    id: number;
    stableId: number;
    teamName: string;
    teamSize: number;
    members: Array<{ robot: Robot; slotIndex: number; robotId: number }>;
    stable: { id: number; username: string; stableName: string | null };
  };
  team2: {
    id: number;
    stableId: number;
    teamName: string;
    teamSize: number;
    members: Array<{ robot: Robot; slotIndex: number; robotId: number }>;
    stable: { id: number; username: string; stableName: string | null };
  } | null;
}

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
  const matchType = teamSize === 2 ? 'league_2v2' : 'league_3v3';

  // Fetch all scheduled matches from unified table (Spec #40)
  const unifiedMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      matchType: matchType as MatchType,
    },
    include: { participants: true },
    orderBy: { scheduledFor: 'asc' },
  });

  // Load team data with members+robots for each match
  const scheduledMatches: ScheduledMatchWithTeams[] = [];
  for (const um of unifiedMatches) {
    const p1 = um.participants.find(p => p.slot === 1);
    const p2 = um.participants.find(p => p.slot === 2);
    if (!p1) continue;

    const team1 = await prisma.teamBattle.findUnique({
      where: { id: p1.participantId },
      include: { members: { include: { robot: true } }, stable: true },
    });
    const team2 = p2 ? await prisma.teamBattle.findUnique({
      where: { id: p2.participantId },
      include: { members: { include: { robot: true } }, stable: true },
    }) : null;

    if (!team1) continue;

    // Build a ScheduledMatchWithTeams-compatible object
    scheduledMatches.push({
      id: um.id,
      team1Id: p1.participantId,
      team2Id: p2?.participantId ?? null,
      teamSize,
      matchMode: matchType,
      teamBattleLeague: um.leagueType ?? 'bronze',
      teamBattleLeagueId: um.leagueInstanceId ?? 'bronze_1',
      scheduledFor: um.scheduledFor,
      status: um.status,
      cancelReason: um.cancelReason,
      createdAt: um.createdAt,
      team1,
      team2,
    } as unknown as ScheduledMatchWithTeams);
  }

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
      // R10.5 / rule 7: cancel the match via the shared policy, continue remaining
      const { errorSummary } = await handleMatchFailure({
        mode: battleType,
        ref: { source: 'scheduled_match', id: match.id },
        error,
        participants: [match.team1Id, match.team2Id].filter((id): id is number => id !== null),
      });
      results.push({
        matchId: match.id,
        status: 'cancelled',
        error: errorSummary,
      });
    }
  }

  const matchesCompleted = results.filter(r => r.status === 'completed').length;
  const matchesForfeited = results.filter(r => r.status === 'forfeit').length;
  const matchesCancelled = results.filter(r => r.status === 'cancelled').length;
  const durationMs = Date.now() - startTime;

  // R11.1: Structured log line with cycle number, team_size, team IDs, duration, outcome
  logger.info(
    `[TeamBattle] Execution complete | ` +
    `cycle=${cycleNumber} team_size=${teamSize} ` +
    `completed=${matchesCompleted} forfeited=${matchesForfeited} cancelled=${matchesCancelled} ` +
    `total=${scheduledMatches.length} duration_ms=${durationMs}`,
  );

  return { matchesCompleted, matchesForfeited, matchesCancelled, results };
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
  // A bye is detected before the absent side is loaded or fabricated, and it
  // never reaches the simulation below (Spec #49 R12.1, R12.2).
  //
  // This path used to run the entire fought-battle body for a bye: it built
  // `teamSize` Bye_Placeholders, simulated a real battle against them, then
  // overrode the outcome. The placeholders carried no weapon, and the
  // simulator's weaponless fallback punched the real team for the full
  // duration, and the damage was persisted. A walkover was billing players for
  // repairs on a battle nobody fought.
  if (match.team2Id === null) {
    return resolveTeamLeagueBye(match, teamSize, battleType, cycleNumber);
  }

  // Load robots with weapons for both teams
  const team1Robots: RobotWithWeapons[] = await loadCombatRobots(match.team1.members.map(m => m.robotId));
  const team2Robots: RobotWithWeapons[] = await loadCombatRobots(match.team2!.members.map(m => m.robotId));

  // Battle-time readiness (rule 1): any member without a main weapon forfeits
  // the whole team (rule 2); an incomplete loadout fights as single (rule 6).
  const entry = evaluateMatchEntry(team1Robots, team2Robots);
  if (entry.kind !== 'fight') {
    return resolveTeamLeagueForfeit(match, teamSize, battleType, cycleNumber, team1Robots, team2Robots, entry);
  }
  // In memory only, and before prepareRobotForCombat reads loadoutType.
  applyAndLogLoadoutFallbacks([...team1Robots, ...team2Robots], entry.decisions, match.id);

  // Prepare all robots for combat (apply tuning bonuses)
  const tuningMap = await prepareRobotsWithTuning([...team1Robots, ...team2Robots]);

  // Simulate the battle
  const battleResult = simulateTeamBattle(team1Robots, team2Robots, teamSize);

  // Determine winning team ID
  const team1Won = battleResult.winningSide === 1;
  const team2Won = battleResult.winningSide === 2;
  const isDraw = battleResult.isDraw;
  const winnerTeamId = team1Won ? match.team1Id : team2Won ? match.team2Id : null;
  const winningSide = team1Won ? 1 : team2Won ? 2 : null;

  // Compute team ELOs for reward calculation
  const team1SumELO = team1Robots.reduce((sum, r) => sum + r.elo, 0);
  const team2SumELO = team2Robots.reduce((sum, r) => sum + r.elo, 0);

  // Calculate ELO changes
  const eloChanges = calculateTeamBattleELOChanges(
    team1SumELO,
    team2SumELO,
    team1Won,
    isDraw,
  );

  // R7.11: Use Prisma interactive transaction for reward distribution
  // Compressed before the transaction so zstd time is not spent holding it.
  const encodedLog = await encodeBattleLog(buildTeamBattleLog(battleResult, teamSize));
  const battle = await runFinancialWriteTransaction(async (tx, financialCycleNumber) => {
    // Create Battle record
    const battleRecord = await tx.battle.create({
      data: {
        winnerId: winnerTeamId,
        winningSide,
        battleType,
        leagueType: match.teamBattleLeague,
        leagueInstanceId: match.teamBattleLeagueId,
        durationSeconds: Math.round(battleResult.durationSeconds),
        winnerReward: 0, // Updated below
        loserReward: 0,  // Updated below

        ...encodedLog,
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

    // Award stable-level battle income through the same interactive transaction.
    const teamMode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
    const team1Outcome = isDraw ? 'draw' : team1Won ? 'win' : 'loss';
    await awardCreditsWithLedger(
      match.team1.stableId,
      team1Reward,
      'battle_income',
      financialCycleNumber,
      'Team battle reward',
      undefined,
      { battleId: battleRecord.id, teamSize },
      {
        battleId: battleRecord.id,
        mode: teamMode,
        tier: match.teamBattleLeague,
        outcome: team1Outcome,
        participationFloor: team1Reward,
        winComponent: 0,
        teamSize,
        isBye: false,
        tx,
      },
    );
    if (match.team2) {
      const team2Outcome = isDraw ? 'draw' : team2Won ? 'win' : 'loss';
      await awardCreditsWithLedger(
        match.team2.stableId,
        team2Reward,
        'battle_income',
        financialCycleNumber,
        'Team battle reward',
        undefined,
        { battleId: battleRecord.id, teamSize },
        {
          battleId: battleRecord.id,
          mode: teamMode,
          tier: match.teamBattleLeague,
          outcome: team2Outcome,
          participationFloor: team2Reward,
          winComponent: 0,
          teamSize,
          isBye: false,
          tx,
        },
      );
    }

    // Calculate fame and prestige
    const fame = calculateTeamBattleFame(match.teamBattleLeague);
    const team1Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team1Won, isDraw);
    const team2Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team2Won, isDraw);
    // The per-robot prestige records split the one stable award with the credit
    // remainder rule, so they sum to it (5 over 2 robots → 3 + 2, not 2 + 2).
    const team1PrestigeShares = distributeTeamCredits(team1Prestige, team1Robots.map(r => ({ robotId: r.id })));
    const team2PrestigeShares = distributeTeamCredits(team2Prestige, team2Robots.map(r => ({ robotId: r.id })));

    // Award stable-level prestige through the same transaction; it is not a credit row.
    await awardPrestigeToUser(match.team1.stableId, team1Prestige, financialCycleNumber, {
      source: 'battle',
      mode: teamMode,
      battleId: battleRecord.id,
      tx,
    });
    if (match.team2) {
      await awardPrestigeToUser(match.team2.stableId, team2Prestige, financialCycleNumber, {
        source: 'battle',
        mode: teamMode,
        battleId: battleRecord.id,
        tx,
      });
    }

    // Calculate LP deltas
    const team1LPDelta = calculateTeamBattleLPDelta(team1Won, isDraw);
    const team2LPDelta = calculateTeamBattleLPDelta(team2Won, isDraw);

    // Update team 1 standings via unified service
    const team1Mode = teamMode;
    await standingsService.recordBattleResult({
      entityType: 'team',
      entityId: match.team1Id,
      mode: team1Mode as StandingsMode,
      outcome: team1Outcome,
      lpDelta: team1LPDelta,
    }, tx);

    // Update team 2 standings (skip for bye)
    if (match.team2Id) {
      const team2Outcome = isDraw ? 'draw' : team2Won ? 'win' : 'loss';
      await standingsService.recordBattleResult({
        entityType: 'team',
        entityId: match.team2Id,
        mode: team1Mode as StandingsMode,
        outcome: team2Outcome,
        lpDelta: team2LPDelta,
      }, tx);
    }

    // Update individual robot ELOs and team battle win counters (R16.2)
    // Also persist currentHP from battle result so damage carries over to next cycle
    // NOTE: Robot combat stats are now updated AFTER the transaction via updateRobotCombatStats

    for (const robot of team1Robots) {
      const robotCredits = team1Credits.find(c => c.robotId === robot.id);
      // Update BattleParticipant with final values
      await tx.battleParticipant.updateMany({
        where: { battleId: battleRecord.id, robotId: robot.id },
        data: {
          credits: robotCredits?.credits ?? 0,
          eloAfter: robot.elo + eloChanges.team1Change,
          prestigeAwarded: team1PrestigeShares.find(p => p.robotId === robot.id)?.credits ?? 0,
          fameAwarded: team1Won ? fame : 0,
        },
      });
    }

    {
      for (const robot of team2Robots) {
        const robotCredits = team2Credits.find(c => c.robotId === robot.id);
        // Update BattleParticipant with final values
        await tx.battleParticipant.updateMany({
          where: { battleId: battleRecord.id, robotId: robot.id },
          data: {
            credits: robotCredits?.credits ?? 0,
            eloAfter: robot.elo + eloChanges.team2Change,
            prestigeAwarded: team2PrestigeShares.find(p => p.robotId === robot.id)?.credits ?? 0,
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

    // Mark match as completed in unified table
    await tx.scheduledMatch.update({
      where: { id: match.id },
      data: { status: 'completed' },
    });

    return battleRecord;
  }, { timeout: 30_000 }); // End transaction (R7.11: rollback on failure)

  await recordCombatBuilds(battle.id, battleType, [...team1Robots, ...team2Robots]);

  // Write pre-computed battle summary (Spec #39 — outside transaction, non-blocking)
  await writeTeamBattleSummary(battle.id, battleType, battleResult, team1Robots, team2Robots, '[TeamBattle]');

  // ── Post-transaction: robot combat stat updates via unified function ──
  const postTxFame = calculateTeamBattleFame(match.teamBattleLeague);
  await updateTeamBattleCombatStats({
    result: battleResult,
    sides: [
      { team: 1, robots: team1Robots, eloChange: eloChanges.team1Change, isWinner: team1Won, fameIncrement: team1Won ? postTxFame : 0 },
      { team: 2, robots: team2Robots, eloChange: eloChanges.team2Change, isWinner: team2Won, fameIncrement: team2Won ? postTxFame : 0 },
    ],
    teamSize,
    isDraw,
    battleType: teamSize === 2 ? 'league_2v2' : 'league_3v3',
  });

  // ── Post-transaction: streaming revenue + audit logs (non-blocking) ──

  // Award streaming revenue per robot
  for (const robot of team1Robots) {
    await awardStreamingRevenueForParticipant(
      robot.id, match.team1.stableId, battle.id, false, teamSize,
      teamSize === 2 ? 'league_2v2' : 'league_3v3',
    );
  }
  if (match.team2) {
    for (const robot of team2Robots) {
      await awardStreamingRevenueForParticipant(
        robot.id, match.team2.stableId, battle.id, false, teamSize,
        teamSize === 2 ? 'league_2v2' : 'league_3v3',
      );
    }
  }

  // R10.4: Emit audit log rows per participating robot
  // R9.7: Include team_size, outcome, opponent team name, and Team_LP delta in notification extras
  const team1Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team1Won, isDraw);
  const team2Prestige = calculateTeamBattlePrestige(match.teamBattleLeague, team2Won, isDraw);
  // Same split as the participant rows, so audit events sum to the stable award.
  const team1PrestigeShares = distributeTeamCredits(team1Prestige, team1Robots.map(r => ({ robotId: r.id })));
  const team2PrestigeShares = distributeTeamCredits(team2Prestige, team2Robots.map(r => ({ robotId: r.id })));
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
  const team1OpponentName = match.team2?.teamName ?? 'Unknown';
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
          prestige: team1PrestigeShares.find(p => p.robotId === robot.id)?.credits ?? 0,
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
        false, // never a bye — byes return before this point (Spec #49)
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

  if (match.team2) {
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
            prestige: team2PrestigeShares.find(p => p.robotId === robot.id)?.credits ?? 0,
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

  // Check and award achievements for all participating robots. Each robot's
  // context comes from its own build and result: placeholder values here once
  // made every team win count as a 0%-yield, untuned, near-death win.
  const awardTeamAchievements = async (
    robots: RobotWithWeapons[],
    stableId: number,
    won: boolean,
  ): Promise<void> => {
    const teamAllSurvived = robots.every(
      (robot) => (battleResult.participants.find(p => p.robotId === robot.id)?.finalHP ?? 0) > 0,
    );
    for (const robot of robots) {
      const participant = battleResult.participants.find(p => p.robotId === robot.id);
      const finalHP = participant?.finalHP ?? 0;
      const prevLost = await didRobotLosePreviousBattle(robot.id, battle.id);
      await checkAndAwardAchievements(stableId, robot.id, {
        won,
        destroyed: finalHP === 0,
        finalHpPercent: hpPercentOf(finalHP, robot.maxHP),
        eloChange: 0,
        opponentElo: 0,
        yielded: false,
        opponentYielded: false,
        previousBattleLost: prevLost,
        damageDealt: participant?.damageDealt ?? 0,
        opponentDamageDealt: 0,
        loadoutType: robot.loadoutType || 'single',
        stance: robot.stance || 'balanced',
        yieldThreshold: robot.yieldThreshold,
        hasTuning: hasAllocatedTuning(tuningMap.get(robot.id)),
        hasMainWeapon: robot.mainWeaponId !== null,
        battleType,
        battleDurationSeconds: battleResult.durationSeconds,
        battleId: battle.id,
        isDraw,
        teamSize,
        teamAllSurvived,
        minHpPercent: lowestHpPercent(battleResult.detailedCombatEvents, robot.name, robot.maxHP, finalHP),
      });
    }
  };

  await awardTeamAchievements(team1Robots, match.team1.stableId, team1Won);
  if (match.team2) {
    await awardTeamAchievements(team2Robots, match.team2.stableId, team2Won);
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
