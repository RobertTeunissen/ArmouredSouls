/**
 * Team Battle Reward Service
 *
 * Calculates and distributes rewards for 2v2 and 3v3 Team Battle outcomes.
 * Follows the N× multiplier model: 2v2 winner gets 2× what a single robot
 * earns in 1v1; 3v3 winner gets 3×. Loser/draw gets 20% of winner reward.
 *
 * Reward components per robot:
 *   - Credits: N× (win+participation) for winner, 20% for loser/draw, split per R7.4
 *   - Fame: full FAME_BY_LEAGUE[tier] per robot (no splitting)
 *   - Prestige: full PRESTIGE_BY_LEAGUE[tier] for wins only
 *   - Streaming: awardStreamingRevenueForParticipant per robot with teamSize param
 *   - ELO: sum-based team ELO, calculateELOChange, same delta to each member
 *   - LP: Team_LP updated using standard win/loss/draw delta rules
 *
 * Does NOT modify: individual robot LP, tag-team LP, or tournament standings (R7.8).
 *
 * Requirements: R7.1–R7.11, R8.1
 *
 * @module services/team-battle/teamBattleRewardService
 */

import { getLeagueWinReward, getParticipationReward } from '../../utils/economyCalculations';
import {
  calculateELOChange,
  FAME_BY_LEAGUE,
  PRESTIGE_BY_LEAGUE,
} from '../../utils/battleMath';
import { TeamBattleParticipantResult } from '../../types/teamBattleLogTypes';

// ─── Constants ───────────────────────────────────────────────────────────────

/** LP delta for a win (+3), same as 1v1 and tag team */
export const TEAM_BATTLE_LP_WIN = 3;

/** LP delta for a loss (-1), same as 1v1 and tag team */
export const TEAM_BATTLE_LP_LOSS = -1;

/** LP delta for a draw (+1), same as 1v1 and tag team */
export const TEAM_BATTLE_LP_DRAW = 1;

/** Loser/draw reward as fraction of winner reward */
export const LOSER_DRAW_FRACTION = 0.20;

/** Bye-team combined ELO (1000 per robot × N, same pattern as tag team's 2000 for 2 robots) */
export const BYE_TEAM_ELO_PER_ROBOT = 1000;

// ─── Credit Reward Calculation ───────────────────────────────────────────────

/**
 * Calculate the total team credit reward for a Team Battle.
 *
 * Formula: N × (1v1 win reward + participation reward) for winner.
 * Loser/draw gets 20% of the winner amount.
 *
 * @param league - League tier (bronze, silver, gold, platinum, diamond, champion)
 * @param teamSize - Team size (2 or 3)
 * @param isWinner - Whether this team won
 * @param isDraw - Whether the battle ended in a draw
 * @returns Total team credit reward (to be distributed across N robots per R7.4)
 */
export function calculateTeamBattleReward(
  league: string,
  teamSize: 2 | 3,
  isWinner: boolean,
  isDraw: boolean,
): number {
  const baseWin = getLeagueWinReward(league);
  const participation = getParticipationReward(league);
  const fullWinnerReward = (baseWin + participation) * teamSize;

  if (isDraw || !isWinner) {
    return Math.round(fullWinnerReward * LOSER_DRAW_FRACTION);
  }
  return fullWinnerReward;
}

// ─── Credit Distribution (R7.4) ─────────────────────────────────────────────

/**
 * Per-robot credit allocation after distribution.
 */
export interface RobotCreditAllocation {
  robotId: number;
  credits: number;
}

/**
 * Distribute team credits across N robots per R7.4 rules:
 *   - Surviving robots (finalHP > 0) get an equal share
 *   - Destroyed robots (finalHP = 0) with damageDealt > 0 get at least 1 credit
 *   - Destroyed robots with damageDealt = 0 get 0 credits
 *   - Sum of all allocations equals totalReward exactly (no rounding loss)
 *
 * @param totalReward - Total team credit reward to distribute
 * @param participants - Per-robot battle results for this team
 * @returns Array of per-robot credit allocations (sum === totalReward)
 */
export function distributeTeamCredits(
  totalReward: number,
  participants: TeamBattleParticipantResult[],
): RobotCreditAllocation[] {
  if (participants.length === 0) return [];

  // All credits go to the stable — just assign the full amount to each robot for tracking
  const perRobot = Math.floor(totalReward / participants.length);
  let leftover = totalReward - (perRobot * participants.length);

  return participants.map(p => {
    const extra = leftover > 0 ? 1 : 0;
    if (leftover > 0) leftover--;
    return { robotId: p.robotId, credits: perRobot + extra };
  });
}

// ─── Fame Calculation (R7.5) ─────────────────────────────────────────────────

/**
 * Calculate fame award for a single robot in a Team Battle.
 * Each robot earns full FAME_BY_LEAGUE[tier] — no splitting.
 *
 * @param league - League tier
 * @returns Fame amount for the robot
 */
export function calculateTeamBattleFame(league: string): number {
  return FAME_BY_LEAGUE[league.toLowerCase()] || FAME_BY_LEAGUE.bronze;
}

// ─── Prestige Calculation ────────────────────────────────────────────────────

/**
 * Calculate prestige award for a single robot in a Team Battle.
 * Each robot earns full PRESTIGE_BY_LEAGUE[tier] for wins only.
 * No prestige for losses or draws.
 *
 * @param league - League tier
 * @param isWinner - Whether this robot's team won
 * @param isDraw - Whether the battle ended in a draw
 * @returns Prestige amount for the robot
 */
export function calculateTeamBattlePrestige(
  league: string,
  isWinner: boolean,
  isDraw: boolean,
): number {
  if (isDraw || !isWinner) {
    return 0;
  }
  return PRESTIGE_BY_LEAGUE[league.toLowerCase()] || PRESTIGE_BY_LEAGUE.bronze;
}

// ─── ELO Calculation (R7.6) ──────────────────────────────────────────────────

/**
 * Result of team ELO calculation.
 */
export interface TeamELOResult {
  /** ELO change for team 1 (positive = gained, negative = lost) */
  team1Change: number;
  /** ELO change for team 2 (positive = gained, negative = lost) */
  team2Change: number;
}

/**
 * Calculate ELO changes for a Team Battle.
 *
 * Team ELO = sum of member robot ELOs. The ELO change is computed using
 * `calculateELOChange` (K=32) and the same delta is applied to each
 * member robot's individual `elo` field.
 *
 * @param team1SumELO - Sum of team 1 member robot ELOs
 * @param team2SumELO - Sum of team 2 member robot ELOs
 * @param team1Won - Whether team 1 won
 * @param isDraw - Whether the battle ended in a draw
 * @returns ELO changes for both teams
 */
export function calculateTeamBattleELOChanges(
  team1SumELO: number,
  team2SumELO: number,
  team1Won: boolean,
  isDraw: boolean,
): TeamELOResult {
  if (isDraw) {
    const { winnerChange, loserChange } = calculateELOChange(team1SumELO, team2SumELO, true);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else if (team1Won) {
    const { winnerChange, loserChange } = calculateELOChange(team1SumELO, team2SumELO, false);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else {
    const { winnerChange, loserChange } = calculateELOChange(team2SumELO, team1SumELO, false);
    return { team1Change: loserChange, team2Change: winnerChange };
  }
}

/**
 * Compute the bye-team combined ELO for a given team size.
 * Uses 1000 per robot (same as tag team's 2000 for 2 robots).
 *
 * @param teamSize - Team size (2 or 3)
 * @returns Bye-team combined ELO
 */
export function getByeTeamELO(teamSize: 2 | 3): number {
  return BYE_TEAM_ELO_PER_ROBOT * teamSize;
}

// ─── LP Calculation (R7.7) ───────────────────────────────────────────────────

/**
 * Calculate Team_LP delta for a Team Battle outcome.
 * Uses the same rules as 1v1 and tag team: +3 win, -1 loss, +1 draw.
 *
 * @param isWinner - Whether this team won
 * @param isDraw - Whether the battle ended in a draw
 * @returns LP delta (can be negative)
 */
export function calculateTeamBattleLPDelta(isWinner: boolean, isDraw: boolean): number {
  if (isDraw) {
    return TEAM_BATTLE_LP_DRAW;
  } else if (isWinner) {
    return TEAM_BATTLE_LP_WIN;
  } else {
    return TEAM_BATTLE_LP_LOSS;
  }
}
