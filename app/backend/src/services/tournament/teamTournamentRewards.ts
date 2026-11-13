/**
 * Team Tournament Rewards
 *
 * Credit pools, prestige, fame and streaming for a fought team tournament
 * battle (2v2/3v3). Called by the team tournament battle orchestrator on the
 * first run and on a checkpoint resume.
 *
 * @module services/tournament/teamTournamentRewards
 */

import { Tournament } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { distributeTeamCredits } from '../team-battle/teamBattleRewardService';
import { TeamBattleResult } from '../../types/teamBattleLogTypes';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import {
  calculateTournamentWinReward,
  calculateTournamentParticipationReward,
  calculateTournamentFame,
  calculateTournamentPrestige,
} from '../../utils/tournamentRewards';
import { applyTeamCreditPoolFactor } from '../../utils/economyFormulas';
import {
  awardStreamingRevenueForParticipant,
  awardCreditsWithLedger,
  awardPrestigeToUser,
} from '../battle/battlePostCombat';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';

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
 * Prestige for a team tournament match winner: the shared tournament round
 * table, the same as a 1v1 tournament round (#576). Awarded once to the
 * winning team's stable, never × team size. Losers earn zero (handled by caller).
 *
 * @param currentRound - The current round number (1-based)
 * @param maxRounds - Total rounds in the tournament
 * @returns Prestige for the winning stable
 */
export function calculateTeamTournamentPrestige(currentRound: number, maxRounds: number): number {
  return calculateTournamentPrestige(currentRound, maxRounds);
}

/**
 * Distribute rewards for a team tournament battle.
 *
 * Credits: owner pools from `calculateTeamTournamentCreditPools` (round win /
 *   participation reward × teamSize × 0.75, #527), split per robot
 * Prestige: shared tournament round table, once per winning stable (#576; winner only)
 * Fame: calculateTournamentFame with team HP sums (winner only)
 * Streaming: awardStreamingRevenueForParticipant per robot with teamSize
 * ELO: Already applied before this function is called
 *
 * Requirements: R4.7, R6.5, R6.6, R6.7, R6.8, R6.9, R6.10
 */
export async function distributeTeamTournamentRewards(
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

  // ─── Prestige (winner only, once per team) ─────────────────────────
  // One award to the winning stable, like a team league win (#576). Before it
  // was × teamSize, so a 3v3 round paid three times a 1v1 or team league win.
  const winnerPrestige = calculateTeamTournamentPrestige(currentRound, maxRounds);
  // Losers earn ZERO prestige
  await awardPrestigeToUser(winnerOwnerId, winnerPrestige, cycleNumber, {
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
  // Per-robot credits and prestige come from share arrays, so they sum exactly
  // to the stable's award rather than each robot carrying the whole amount.
  const winnerPrestigeShares = distributeTeamCredits(
    winnerPrestige,
    winnerRobots.map(robot => ({ robotId: robot.id })),
  );
  for (const robot of winnerRobots) {
    await prisma.battleParticipant.update({
      where: { battleId_robotId: { battleId, robotId: robot.id } },
      data: {
        credits: winnerShares.find(s => s.robotId === robot.id)?.credits ?? 0,
        prestigeAwarded: winnerPrestigeShares.find(s => s.robotId === robot.id)?.credits ?? 0,
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

export async function calculateTeamTournamentFameAward(
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

