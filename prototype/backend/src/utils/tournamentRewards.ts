/**
 * Tournament Rewards Calculations
 * Handles tournament-specific reward calculations with enhanced multipliers
 */

import { Robot, User } from '@prisma/client';
import {
  getLeagueBaseReward,
  getParticipationReward,
  getPrestigeMultiplier,
  calculateBattleWinnings,
} from './economyCalculations';

// Tournament reward multipliers
const TOURNAMENT_WIN_MULTIPLIER = 1.5; // 1.5× base win reward
const TOURNAMENT_PRESTIGE_MULTIPLIER = 2.0; // 2× prestige
const TOURNAMENT_FAME_MULTIPLIER = 1.5; // 1.5× fame
const CHAMPIONSHIP_PRESTIGE_BONUS = 500; // Bonus for winning finals

// Round-based multipliers (progressive rewards for deeper rounds)
const ROUND_MULTIPLIERS: { [key: number]: number } = {
  1: 1.0,  // First round (many participants)
  2: 1.2,  // Round of 16/32
  3: 1.4,  // Quarter-finals
  4: 1.6,  // Semi-finals
  5: 2.0,  // Finals
};

/**
 * Get round multiplier based on round number
 */
function getRoundMultiplier(round: number): number {
  return ROUND_MULTIPLIERS[round] || 1.0;
}

/**
 * Calculate tournament win reward with all multipliers
 * Formula: base × prestige × tournament × round
 */
export function calculateTournamentWinReward(
  robot: Robot,
  user: User,
  round: number
): number {
  const leagueReward = getLeagueBaseReward(robot.currentLeague).midpoint;
  const prestigeMultiplier = getPrestigeMultiplier(user.prestige);
  const roundMultiplier = getRoundMultiplier(round);
  
  // Apply all multipliers
  const baseReward = leagueReward * prestigeMultiplier;
  const tournamentReward = baseReward * TOURNAMENT_WIN_MULTIPLIER * roundMultiplier;
  
  return Math.round(tournamentReward);
}

/**
 * Calculate tournament participation reward
 * Same as league battles (30% of league base)
 */
export function calculateTournamentParticipationReward(robot: Robot): number {
  return getParticipationReward(robot.currentLeague);
}

/**
 * Calculate bye match participation reward
 * 50% of normal participation (no combat effort)
 */
export function calculateByeMatchReward(robot: Robot): number {
  const normalParticipation = getParticipationReward(robot.currentLeague);
  return Math.round(normalParticipation * 0.5);
}

/**
 * Calculate prestige award for tournament win
 * Formula: base league prestige × 2.0
 * Finals add +500 bonus prestige
 */
export function calculateTournamentPrestige(
  robot: Robot,
  round: number,
  maxRounds: number
): number {
  // Base prestige by league
  const prestigeByLeague: Record<string, number> = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };
  
  const basePrestige = prestigeByLeague[robot.currentLeague] || 0;
  let tournamentPrestige = Math.round(basePrestige * TOURNAMENT_PRESTIGE_MULTIPLIER);
  
  // Finals bonus (championship title round)
  const isFinals = round === maxRounds;
  if (isFinals) {
    tournamentPrestige += CHAMPIONSHIP_PRESTIGE_BONUS;
  }
  
  return tournamentPrestige;
}

/**
 * Calculate fame award for tournament win
 * Formula: (base league fame × performance multiplier) × 1.5
 */
export function calculateTournamentFame(
  robot: Robot,
  winnerFinalHP: number,
  round: number
): number {
  // Base fame by league
  const fameByLeague: Record<string, number> = {
    bronze: 2,
    silver: 5,
    gold: 10,
    platinum: 15,
    diamond: 25,
    champion: 40,
  };
  
  let baseFame = fameByLeague[robot.currentLeague] || 0;
  
  // Performance multipliers (same as league battles)
  const hpPercent = winnerFinalHP / robot.maxHP;
  
  if (winnerFinalHP === robot.maxHP) {
    // Perfect victory (no HP damage taken)
    baseFame *= 2.0;
  } else if (hpPercent > 0.8) {
    // Dominating victory (>80% HP remaining)
    baseFame *= 1.5;
  } else if (hpPercent < 0.2) {
    // Comeback victory (<20% HP remaining)
    baseFame *= 1.25;
  }
  
  // Apply tournament multiplier
  const tournamentFame = baseFame * TOURNAMENT_FAME_MULTIPLIER;
  
  // Round bonus (later rounds = more fame)
  const roundMultiplier = getRoundMultiplier(round);
  
  return Math.round(tournamentFame * roundMultiplier);
}

/**
 * Get championship bonus prestige
 * Awarded only to final round winner
 */
export function getChampionshipPrestigeBonus(): number {
  return CHAMPIONSHIP_PRESTIGE_BONUS;
}

/**
 * Calculate complete tournament rewards for a battle
 * Returns object with all reward components
 */
export interface TournamentRewards {
  winnerReward: number;
  loserReward: number;
  winnerPrestige: number;
  loserPrestige: number;
  winnerFame: number;
  loserFame: number;
  isFinals: boolean;
  roundMultiplier: number;
}

export async function calculateTournamentBattleRewards(
  winnerRobot: Robot,
  loserRobot: Robot,
  winnerUser: User,
  loserUser: User,
  winnerFinalHP: number,
  round: number,
  maxRounds: number
): Promise<TournamentRewards> {
  // Winner rewards
  const winnerReward = calculateTournamentWinReward(winnerRobot, winnerUser, round);
  const winnerPrestige = calculateTournamentPrestige(winnerRobot, round, maxRounds);
  const winnerFame = calculateTournamentFame(winnerRobot, winnerFinalHP, round);
  
  // Loser rewards (participation only)
  const loserReward = calculateTournamentParticipationReward(loserRobot);
  const loserPrestige = 0; // No prestige for losing
  const loserFame = 0; // No fame for losing
  
  const isFinals = round === maxRounds;
  const roundMultiplier = getRoundMultiplier(round);
  
  return {
    winnerReward,
    loserReward,
    winnerPrestige,
    loserPrestige,
    winnerFame,
    loserFame,
    isFinals,
    roundMultiplier,
  };
}

/**
 * Get tournament reward breakdown for display
 */
export function getTournamentRewardBreakdown(
  rewards: TournamentRewards,
  winnerRobot: Robot,
  loserRobot: Robot,
  winnerUser: User
): string[] {
  const breakdown: string[] = [];
  
  breakdown.push(`💰 Tournament Financial Rewards Summary`);
  breakdown.push(`   Winner (${winnerRobot.name}): ₡${rewards.winnerReward.toLocaleString()}`);
  
  const baseLeagueReward = getLeagueBaseReward(winnerRobot.currentLeague).midpoint;
  const prestigeMultiplier = getPrestigeMultiplier(winnerUser.prestige);
  
  breakdown.push(`      • League Base (${winnerRobot.currentLeague}): ₡${baseLeagueReward.toLocaleString()}`);
  
  if (prestigeMultiplier > 1.0) {
    breakdown.push(`      • Prestige Bonus (${Math.round((prestigeMultiplier - 1) * 100)}%): Applied`);
  }
  
  breakdown.push(`      • Tournament Bonus (${TOURNAMENT_WIN_MULTIPLIER}×): Applied`);
  breakdown.push(`      • Round Multiplier (${rewards.roundMultiplier}×): Applied`);
  
  if (rewards.isFinals) {
    breakdown.push(`      • 🏆 CHAMPIONSHIP FINALS 🏆`);
  }
  
  breakdown.push(`   Loser (${loserRobot.name}): ₡${rewards.loserReward.toLocaleString()}`);
  breakdown.push(`      • Participation: ₡${rewards.loserReward.toLocaleString()}`);
  
  // Prestige breakdown
  if (rewards.winnerPrestige > 0) {
    breakdown.push(`   Prestige: +${rewards.winnerPrestige} (${winnerRobot.name})`);
    if (rewards.isFinals) {
      breakdown.push(`      • Championship Bonus: +${CHAMPIONSHIP_PRESTIGE_BONUS}`);
    }
  }
  
  // Fame breakdown
  if (rewards.winnerFame > 0) {
    breakdown.push(`   Fame: +${rewards.winnerFame} (${winnerRobot.name})`);
  }
  
  return breakdown;
}
