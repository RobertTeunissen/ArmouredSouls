import { Robot } from '../../../generated/prisma';
import { getLeagueWinReward, getParticipationReward } from '../../utils/economyCalculations';
import { calculateELOChange } from '../../utils/battleMath';
import { TAG_TEAM_REWARD_MULTIPLIER, TAG_TEAM_PRESTIGE_MULTIPLIER } from './tagTeamTypes';

/**
 * Calculate rewards for a tag team battle
 * Requirement 4.1, 4.2, 4.3: 2x standard league rewards
 */
export function calculateTagTeamRewards(
  league: string,
  isWinner: boolean,
  isDraw: boolean
): number {
  const baseReward = getLeagueWinReward(league);
  const participationReward = getParticipationReward(league);

  let reward: number;

  if (isDraw) {
    // Draw: participation reward only
    reward = participationReward;
  } else if (isWinner) {
    // Win: base reward + participation
    reward = baseReward + participationReward;
  } else {
    // Loss: participation reward only
    reward = participationReward;
  }

  // Apply 2x multiplier for tag team matches
  return Math.round(reward * TAG_TEAM_REWARD_MULTIPLIER);
}

/**
 * Calculate ELO changes for tag team battles
 * Requirements 5.1, 5.2: Use combined team ELO, K=32 formula
 */
export function calculateTagTeamELOChanges(
  team1CombinedELO: number,
  team2CombinedELO: number,
  team1Won: boolean,
  isDraw: boolean
): { team1Change: number; team2Change: number } {
  if (isDraw) {
    const { winnerChange, loserChange } = calculateELOChange(team1CombinedELO, team2CombinedELO, true);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else if (team1Won) {
    const { winnerChange, loserChange } = calculateELOChange(team1CombinedELO, team2CombinedELO, false);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else {
    const { winnerChange, loserChange } = calculateELOChange(team2CombinedELO, team1CombinedELO, false);
    return { team1Change: loserChange, team2Change: winnerChange };
  }
}

/**
 * Calculate league point changes for tag team battles
 * Requirements 5.3, 5.4, 5.5
 */
export function calculateTagTeamLeaguePoints(isWinner: boolean, isDraw: boolean): number {
  if (isDraw) {
    return 1; // +1 for draws
  } else if (isWinner) {
    return 3; // +3 for wins
  } else {
    return -1; // -1 for losses (minimum 0 enforced at update time)
  }
}

/**
 * Calculate prestige award for tag team battle
 * Requirements 10.1-10.6: 1.6x standard individual match prestige
 */
export function calculateTagTeamPrestige(
  league: string,
  isWinner: boolean,
  isDraw: boolean
): number {
  if (isDraw || !isWinner) {
    return 0; // No prestige for draws or losses
  }

  // Standard individual match prestige by league
  const standardPrestige: Record<string, number> = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };

  const basePrestige = standardPrestige[league] || 0;
  return Math.round(basePrestige * TAG_TEAM_PRESTIGE_MULTIPLIER);
}

/**
 * Calculate fame award based on contribution
 * Requirement 10.7: Fame based on damage dealt and survival time
 * Fame is only awarded to robots on the WINNING team
 */
export function calculateTagTeamFame(
  leagueType: string,
  robot: Robot,
  damageDealt: number,
  survivalTime: number,
  totalBattleTime: number,
  isWinner: boolean,
  isDraw: boolean
): number {
  // Only winners get fame (consistent with 1v1 battles)
  if (isDraw || !isWinner) {
    return 0;
  }

  // Base fame by league
  const baseFameByLeague: Record<string, number> = {
    bronze: 2,
    silver: 5,
    gold: 10,
    platinum: 15,
    diamond: 25,
    champion: 40,
  };

  const baseFame = baseFameByLeague[leagueType] || 0;

  // If robot didn't participate (0 survival time), they still get base fame as part of winning team
  if (survivalTime === 0) {
    return baseFame;
  }

  // Contribution multiplier based on damage dealt (0.5x to 1.5x)
  const damageMultiplier = Math.min(1.5, Math.max(0.5, damageDealt / 100));

  // Survival multiplier based on time in battle (0.5x to 1.5x)
  const survivalMultiplier = Math.min(
    1.5,
    Math.max(0.5, survivalTime / totalBattleTime)
  );

  // Apply contribution multipliers
  const finalFame = baseFame * damageMultiplier * survivalMultiplier;

  return Math.round(finalFame);
}
