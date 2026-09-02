/**
 * Battle display formatters — pure utility functions for formatting
 * battle-related data for UI display.
 *
 * Uses the `participants` array as the canonical source of per-robot data.
 * Falls back to legacy robot1/robot2 fields for older responses.
 *
 * Split from matchmakingApi.ts for separation of concerns.
 * Re-exported from matchmakingApi.ts to maintain backwards compatibility.
 */

import type { BattleHistory, BattleParticipantData } from './matchmakingApi';

// ─── Participant helpers ─────────────────────────────────────────────────────

/** Find the participant record for a given robot. */
function findParticipant(battle: BattleHistory, robotId: number): BattleParticipantData | undefined {
  return battle.participants?.find(p => p.robotId === robotId);
}

/** Find the participant by userId (first match). */
function findParticipantByUserId(battle: BattleHistory, userId: number): BattleParticipantData | undefined {
  return battle.participants?.find(p => p.robot.userId === userId);
}

// ─── Perspective (who is "me" vs "opponent") ─────────────────────────────────

export interface BattlePerspective {
  myRobot: { id: number; name: string; userId: number; user: { username: string } };
  opponent: { id: number; name: string; userId: number; user: { username: string } } | null;
  myRobotId: number;
  outcome: 'win' | 'loss' | 'draw';
  eloChange: number;
}

/**
 * Derive full battle perspective from participants.
 * Use `robotId` when viewing a specific robot's page.
 * Use `userId` when viewing the dashboard / battle history (any of my robots).
 */
export function getBattlePerspective(
  battle: BattleHistory,
  context: { robotId?: number; userId?: number },
): BattlePerspective {
  const { robotId, userId } = context;

  // Find "my" participant
  let myPart: BattleParticipantData | undefined;
  if (robotId && battle.participants?.length) {
    myPart = findParticipant(battle, robotId);
  } else if (userId && battle.participants?.length) {
    myPart = findParticipantByUserId(battle, userId);
  }

  // Find opponent (first participant on the other team, or first non-me)
  let opponentPart: BattleParticipantData | undefined;
  if (myPart && battle.participants?.length) {
    opponentPart = battle.participants.find(
      p => p.team !== myPart!.team && (p.role === 'active' || p.role === 'solo' || p.role === null),
    ) ?? battle.participants.find(p => p.robotId !== myPart!.robotId);
  }

  // Build robot display objects — when no participants, use robotId/userId to pick the right side
  let myRobot: BattlePerspective['myRobot'];
  let opponent: BattlePerspective['opponent'];
  if (myPart) {
    myRobot = myPart.robot;
    opponent = battle.isByeMatch ? null : (opponentPart?.robot ?? battle.robot2);
  } else {
    // Legacy fallback: determine side from robotId or userId
    const isRobot1 = robotId
      ? battle.robot1Id === robotId
      : userId
        ? battle.robot1.userId === userId
        : true;
    myRobot = isRobot1 ? battle.robot1 : (battle.robot2 ?? battle.robot1);
    opponent = battle.isByeMatch ? null : (isRobot1 ? battle.robot2 : battle.robot1);
  }
  const myRobotId = myPart?.robotId ?? robotId ?? myRobot.id;

  const outcome = getBattleOutcome(battle, myRobotId);
  const eloChange = getELOChange(battle, myRobotId);

  return { myRobot, opponent, myRobotId, outcome, eloChange };
}

// ─── Outcome determination ───────────────────────────────────────────────────

export const getBattleOutcome = (battle: BattleHistory, robotId: number): 'win' | 'loss' | 'draw' => {
  // BYE matches are always a win for the real team, even if legacy rows omit winnerId.
  if (battle.isByeMatch) return 'win';
  if (!battle.winnerId) return 'draw';

  // FFA modes: use participant's placement field (canonical), fallback to battle.kothPlacement (legacy)
  if (battle.battleType === 'koth' || battle.battleType === 'grand_melee') {
    const participant = findParticipant(battle, robotId);
    const placement = participant?.placement ?? battle.kothPlacement;
    if (placement != null) {
      return placement === 1 ? 'win' : 'loss';
    }
  }

  // If we have participants, use team membership to determine outcome for team modes
  const participant = findParticipant(battle, robotId);
  if (isTeamBattleType(battle.battleType)) {
    if (participant) {
      // Best path: use winningSide
      if (battle.winningSide != null) {
        return participant.team === battle.winningSide ? 'win' : 'loss';
      }
      // Fallback: winnerId is the team ID — match against team1Id/team2Id
      if (battle.team1Id != null) {
        const myTeamId = participant.team === 1 ? battle.team1Id : battle.team2Id;
        return battle.winnerId === myTeamId ? 'win' : 'loss';
      }
    }
    // Legacy fallback (no participants): infer team from robot1Id/robot2Id
    if (battle.team1Id != null) {
      const isTeam1 = battle.robot1Id === robotId;
      const isTeam2 = battle.robot2Id === robotId;
      if (isTeam1) return battle.winnerId === battle.team1Id ? 'win' : 'loss';
      if (isTeam2) return battle.winnerId === battle.team2Id ? 'win' : 'loss';
    }
  }

  // Tag team: winnerId is team ID
  if (battle.battleType === 'tag_team' && battle.team1Id != null) {
    if (participant) {
      const myTeamId = participant.team === 1 ? battle.team1Id : battle.team2Id;
      return battle.winnerId === myTeamId ? 'win' : 'loss';
    }
    // Legacy fallback using robot1Id/robot2Id
    if (battle.robot1Id === robotId) {
      return battle.winnerId === battle.team1Id ? 'win' : 'loss';
    } else if (battle.robot2Id === robotId) {
      return battle.winnerId === battle.team2Id ? 'win' : 'loss';
    }
  }

  // For 1v1 battles, winnerId is the robot ID
  return battle.winnerId === robotId ? 'win' : 'loss';
};

// ─── ELO change ──────────────────────────────────────────────────────────────

export const getELOChange = (battle: BattleHistory, robotId: number): number => {
  // Use participants if available
  const participant = findParticipant(battle, robotId);
  if (participant) {
    return participant.eloAfter - participant.eloBefore;
  }
  // Legacy fallback
  if (battle.robot1Id === robotId) {
    return battle.robot1ELOAfter - battle.robot1ELOBefore;
  }
  return battle.robot2ELOAfter - battle.robot2ELOBefore;
};

// ─── Economic display ────────────────────────────────────────────────────────

export interface BattleEconomicDisplay {
  credits: number;
  streamingRevenue: number;
  fameAwarded: number;
  prestigeAwarded: number;
}

function getLegacyEconomicDisplay(battle: BattleHistory, robotId: number): BattleEconomicDisplay {
  const outcome = getBattleOutcome(battle, robotId);
  return {
    credits: outcome === 'win' ? battle.winnerReward : battle.loserReward,
    streamingRevenue: battle.streamingRevenue ?? 0,
    fameAwarded: battle.fameAwarded ?? 0,
    prestigeAwarded: battle.prestigeAwarded ?? 0,
  };
}

/**
 * Aggregate additive economics for the represented stable side of a battle.
 *
 * Non-FFA modes aggregate same-owner participants on the perspective
 * participant's team. Placement modes intentionally remain one robot per
 * display instance, so their values are not merged across FFA participants.
 */
export const getBattleEconomicDisplay = (
  battle: BattleHistory,
  robotId: number,
): BattleEconomicDisplay => {
  const participants = battle.participants;
  const perspectiveParticipant = findParticipant(battle, robotId);

  if (!participants?.length || !perspectiveParticipant) {
    return getLegacyEconomicDisplay(battle, robotId);
  }

  const isPlacementMode = battle.battleType === 'koth' || battle.battleType === 'grand_melee';
  const perspectiveParticipants = isPlacementMode
    ? [perspectiveParticipant]
    : participants.filter(
      participant => participant.robot.userId === perspectiveParticipant.robot.userId
        && participant.team === perspectiveParticipant.team,
    );

  return {
    credits: perspectiveParticipants.reduce((total, participant) => total + participant.credits, 0),
    streamingRevenue: perspectiveParticipants.reduce(
      (total, participant) => total + participant.streamingRevenue,
      0,
    ),
    fameAwarded: perspectiveParticipants.reduce(
      (total, participant) => total + participant.fameAwarded,
      0,
    ),
    // Prestige is a participant-level display allocation, not an additive
    // stable total. Preserve the selected perspective participant exactly once.
    prestigeAwarded: perspectiveParticipant.prestigeAwarded,
  };
};

/**
 * Get the credit total for a specific battle perspective.
 *
 * Kept as a compatibility helper for sorting and existing callers; all
 * participant aggregation lives in getBattleEconomicDisplay.
 */
export const getBattleReward = (battle: BattleHistory, robotId: number): number => {
  return getBattleEconomicDisplay(battle, robotId).credits;
};

// ─── Formatting utilities ────────────────────────────────────────────────────

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

/** Check if a battle type is a team battle type. */
export function isTeamBattleType(battleType?: string): boolean {
  return battleType === 'tag_team' || battleType === 'league_2v2' || battleType === 'league_3v3' || battleType === 'tournament_2v2' || battleType === 'tournament_3v3';
}
