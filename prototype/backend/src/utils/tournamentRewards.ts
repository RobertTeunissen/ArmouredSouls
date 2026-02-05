/**
 * Tournament Rewards Calculations
 * Rewards based on tournament size and progression, NOT robot's league
 * Formula scales from small (15 robots) to massive (100k+ robots) tournaments
 */

import { Robot, User } from '@prisma/client';

// Base reward amounts (not league-dependent)
const BASE_CREDIT_REWARD = 50000; // Base credits for tournament win
const BASE_PRESTIGE_REWARD = 30; // Base prestige for tournament win
const BASE_FAME_REWARD = 20; // Base fame for tournament win
const CHAMPIONSHIP_PRESTIGE_BONUS = 500; // Bonus for winning finals

/**
 * Calculate tournament size multiplier
 * Formula: 1 + log10(totalParticipants / 10)
 * 
 * Examples:
 * - 15 robots: 1 + log10(1.5) = 1.18
 * - 100 robots: 1 + log10(10) = 2.0
 * - 1000 robots: 1 + log10(100) = 3.0
 * - 100,000 robots: 1 + log10(10000) = 5.0
 */
export function calculateTournamentSizeMultiplier(totalParticipants: number): number {
  if (totalParticipants < 1) return 1.0;
  return 1 + Math.log10(totalParticipants / 10);
}

/**
 * Calculate round progression multiplier
 * Formula: currentRound / maxRounds
 * 
 * Rewards increase as tournament progresses
 * - Round 1/4: 0.25
 * - Round 2/4: 0.5
 * - Round 3/4: 0.75
 * - Round 4/4 (Finals): 1.0
 */
export function calculateRoundProgressMultiplier(
  currentRound: number,
  maxRounds: number
): number {
  if (maxRounds === 0) return 1.0;
  return currentRound / maxRounds;
}

/**
 * Calculate exclusivity multiplier for fame
 * Formula: (robotsRemaining / totalParticipants)^-0.5
 * 
 * Fame increases as fewer robots remain (more exclusive achievement)
 * - 50% remaining: 1.41×
 * - 25% remaining: 2.0×
 * - 10% remaining: 3.16×
 * - 1% remaining: 10×
 */
export function calculateExclusivityMultiplier(
  robotsRemaining: number,
  totalParticipants: number
): number {
  if (totalParticipants === 0 || robotsRemaining === 0) return 1.0;
  const ratio = robotsRemaining / totalParticipants;
  return Math.pow(ratio, -0.5);
}

/**
 * Calculate tournament win credits
 * Formula: BASE × tournamentSizeMultiplier × roundProgressMultiplier
 */
export function calculateTournamentWinReward(
  totalParticipants: number,
  currentRound: number,
  maxRounds: number
): number {
  const sizeMultiplier = calculateTournamentSizeMultiplier(totalParticipants);
  const progressMultiplier = calculateRoundProgressMultiplier(currentRound, maxRounds);
  
  const reward = BASE_CREDIT_REWARD * sizeMultiplier * progressMultiplier;
  return Math.round(reward);
}

/**
 * Calculate tournament prestige award
 * Formula: BASE × roundProgressMultiplier × tournamentSizeMultiplier
 * Finals add +500 championship bonus
 */
export function calculateTournamentPrestige(
  totalParticipants: number,
  currentRound: number,
  maxRounds: number
): number {
  const sizeMultiplier = calculateTournamentSizeMultiplier(totalParticipants);
  const progressMultiplier = calculateRoundProgressMultiplier(currentRound, maxRounds);
  
  let prestige = BASE_PRESTIGE_REWARD * progressMultiplier * sizeMultiplier;
  
  // Championship bonus for finals
  const isFinals = currentRound === maxRounds;
  if (isFinals) {
    prestige += CHAMPIONSHIP_PRESTIGE_BONUS;
  }
  
  return Math.round(prestige);
}

/**
 * Calculate tournament fame award
 * Formula: BASE × exclusivityMultiplier × performanceBonus
 * 
 * Performance bonus based on HP remaining after victory:
 * - Perfect (100% HP): 2.0×
 * - Dominating (>80% HP): 1.5×
 * - Comeback (<20% HP): 1.25×
 * - Normal: 1.0×
 */
export function calculateTournamentFame(
  totalParticipants: number,
  robotsRemaining: number,
  winnerFinalHP: number,
  winnerMaxHP: number
): number {
  const exclusivityMultiplier = calculateExclusivityMultiplier(
    robotsRemaining,
    totalParticipants
  );
  
  // Performance bonus (same as league battles)
  let performanceBonus = 1.0;
  const hpPercent = winnerFinalHP / winnerMaxHP;
  
  if (winnerFinalHP === winnerMaxHP) {
    performanceBonus = 2.0; // Perfect victory
  } else if (hpPercent > 0.8) {
    performanceBonus = 1.5; // Dominating victory
  } else if (hpPercent < 0.2) {
    performanceBonus = 1.25; // Comeback victory
  }
  
  const fame = BASE_FAME_REWARD * exclusivityMultiplier * performanceBonus;
  return Math.round(fame);
}

/**
 * Calculate complete tournament rewards for a battle
 * Returns object with all reward components
 */
export interface TournamentRewards {
  winnerReward: number;
  loserReward: number; // Always 0 (winner-take-all)
  winnerPrestige: number;
  loserPrestige: number; // Always 0
  winnerFame: number;
  loserFame: number; // Always 0
  isFinals: boolean;
  tournamentSizeMultiplier: number;
  roundProgressMultiplier: number;
}

export async function calculateTournamentBattleRewards(
  totalParticipants: number,
  currentRound: number,
  maxRounds: number,
  robotsRemaining: number,
  winnerFinalHP: number,
  winnerMaxHP: number
): Promise<TournamentRewards> {
  // Winner rewards
  const winnerReward = calculateTournamentWinReward(
    totalParticipants,
    currentRound,
    maxRounds
  );
  const winnerPrestige = calculateTournamentPrestige(
    totalParticipants,
    currentRound,
    maxRounds
  );
  const winnerFame = calculateTournamentFame(
    totalParticipants,
    robotsRemaining,
    winnerFinalHP,
    winnerMaxHP
  );
  
  // Loser rewards (winner-take-all)
  const loserReward = 0;
  const loserPrestige = 0;
  const loserFame = 0;
  
  const isFinals = currentRound === maxRounds;
  const tournamentSizeMultiplier = calculateTournamentSizeMultiplier(totalParticipants);
  const roundProgressMultiplier = calculateRoundProgressMultiplier(currentRound, maxRounds);
  
  return {
    winnerReward,
    loserReward,
    winnerPrestige,
    loserPrestige,
    winnerFame,
    loserFame,
    isFinals,
    tournamentSizeMultiplier,
    roundProgressMultiplier,
  };
}

/**
 * Get tournament reward breakdown for display
 */
export function getTournamentRewardBreakdown(
  rewards: TournamentRewards,
  winnerRobotName: string,
  loserRobotName: string,
  totalParticipants: number,
  currentRound: number,
  maxRounds: number
): string[] {
  const breakdown: string[] = [];
  
  breakdown.push(`💰 Tournament Financial Rewards Summary`);
  breakdown.push(`   Tournament Size: ${totalParticipants} participants`);
  breakdown.push(`   Round: ${currentRound}/${maxRounds}`);
  breakdown.push(``);
  breakdown.push(`   Winner (${winnerRobotName}): ₡${rewards.winnerReward.toLocaleString()}`);
  breakdown.push(`      • Base: ₡${BASE_CREDIT_REWARD.toLocaleString()}`);
  breakdown.push(`      • Tournament Size (${rewards.tournamentSizeMultiplier.toFixed(2)}×): Applied`);
  breakdown.push(`      • Round Progress (${rewards.roundProgressMultiplier.toFixed(2)}×): Applied`);
  
  if (rewards.isFinals) {
    breakdown.push(`      • 🏆 CHAMPIONSHIP FINALS 🏆`);
  }
  
  breakdown.push(`   Loser (${loserRobotName}): ₡0`);
  breakdown.push(`      • Tournament is winner-take-all`);
  
  // Prestige breakdown
  if (rewards.winnerPrestige > 0) {
    breakdown.push(`   Prestige: +${rewards.winnerPrestige} (${winnerRobotName})`);
    if (rewards.isFinals) {
      breakdown.push(`      • Championship Bonus: +${CHAMPIONSHIP_PRESTIGE_BONUS}`);
    }
  }
  
  // Fame breakdown
  if (rewards.winnerFame > 0) {
    breakdown.push(`   Fame: +${rewards.winnerFame} (${winnerRobotName})`);
  }
  
  return breakdown;
}
