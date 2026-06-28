/**
 * Battle display formatters — pure utility functions for formatting
 * battle-related data for UI display.
 *
 * Split from matchmakingApi.ts for separation of concerns.
 * Re-exported from matchmakingApi.ts to maintain backwards compatibility.
 */

import type { BattleHistory } from './matchmakingApi';

export const getBattleOutcome = (battle: BattleHistory, robotId: number): 'win' | 'loss' | 'draw' => {
  if (!battle.winnerId) return 'draw';

  // BYE matches are always a win for the real team
  if (battle.isByeMatch) return 'win';
  
  // For tag team battles, winnerId is the team ID, not robot ID
  if (battle.battleType === 'tag_team' && battle.team1Id) {
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;
    
    if (isTeam1Robot) {
      return battle.winnerId === battle.team1Id ? 'win' : 'loss';
    } else if (isTeam2Robot) {
      return battle.winnerId === battle.team2Id ? 'win' : 'loss';
    }
  }

  // For team battles (2v2/3v3 league AND tournament), winnerId is the team ID
  if ((battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' ||
       battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') && battle.team1Id) {
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;

    if (isTeam1Robot) {
      return battle.winnerId === battle.team1Id ? 'win' : 'loss';
    } else if (isTeam2Robot) {
      return battle.winnerId === battle.team2Id ? 'win' : 'loss';
    }
    // Robot might be a participant but not robot1/robot2 (3v3 team members)
    // In team battles, robot1 is always from team 1 and robot2 from team 2.
    // If the robotId matches neither, determine team membership from API data.
    const participant = (battle as unknown as { participants?: { robotId: number; team: number }[] }).participants?.find(p => p.robotId === robotId);
    if (participant) {
      const myTeamId = participant.team === 1 ? battle.team1Id : battle.team2Id;
      return battle.winnerId === myTeamId ? 'win' : 'loss';
    }
    // Fallback: can't determine team membership — return draw to avoid incorrect win/loss
  }
  
  // For 1v1 battles, winnerId is the robot ID
  return battle.winnerId === robotId ? 'win' : 'loss';
};

export const getELOChange = (battle: BattleHistory, robotId: number): number => {
  if (battle.robot1Id === robotId) {
    return battle.robot1ELOAfter - battle.robot1ELOBefore;
  } else {
    return battle.robot2ELOAfter - battle.robot2ELOBefore;
  }
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export const getTournamentRoundName = (currentRound: number, maxRounds: number): string => {
  const roundsFromEnd = maxRounds - currentRound;
  
  if (roundsFromEnd === 0) return 'Finals';
  if (roundsFromEnd === 1) return 'Semi-finals';
  if (roundsFromEnd === 2) return 'Quarter-finals';
  
  return `Round ${currentRound}/${maxRounds}`;
};

/**
 * Get the reward amount for a specific robot in a battle.
 * Handles both 1v1 and tag team battle types.
 */
export const getBattleReward = (battle: BattleHistory, robotId: number): number => {
  // For tag team battles, determine reward based on team winner
  if (battle.battleType === 'tag_team' && battle.team1Id && battle.team2Id) {
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;
    
    if (isTeam1Robot) {
      return battle.winnerId === battle.team1Id ? battle.winnerReward : battle.loserReward;
    } else if (isTeam2Robot) {
      return battle.winnerId === battle.team2Id ? battle.winnerReward : battle.loserReward;
    }
  }

  // For team battles (2v2/3v3 league AND tournament), winnerId is the team ID — use team IDs to determine outcome
  if ((battle.battleType === 'league_2v2' || battle.battleType === 'league_3v3' ||
       battle.battleType === 'tournament_2v2' || battle.battleType === 'tournament_3v3') && battle.team1Id && battle.team2Id) {
    const isTeam1Robot = battle.robot1Id === robotId;
    const isTeam2Robot = battle.robot2Id === robotId;
    const participant = (battle as unknown as { participants?: { robotId: number; team: number }[] }).participants?.find(p => p.robotId === robotId);

    let myTeamId: number | null = null;
    if (isTeam1Robot) myTeamId = battle.team1Id;
    else if (isTeam2Robot) myTeamId = battle.team2Id;
    else if (participant) myTeamId = participant.team === 1 ? battle.team1Id : battle.team2Id;

    if (myTeamId !== null) {
      return battle.winnerId === myTeamId ? battle.winnerReward : battle.loserReward;
    }
  }
  
  // For 1v1 battles, winnerId is the robot ID
  return battle.winnerId === robotId ? battle.winnerReward : battle.loserReward;
};

/** Check if a battle type is a team battle type. */
export function isTeamBattleType(battleType?: string): boolean {
  return battleType === 'league_2v2' || battleType === 'league_3v3' || battleType === 'tournament_2v2' || battleType === 'tournament_3v3';
}
