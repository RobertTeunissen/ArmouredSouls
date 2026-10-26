/**
 * The admin Battles page's single outcome rule: who won, and how the battle
 * ended. Pure; reads only permanent data (battle row, participants, bracket
 * markers, summary), never the 7-day `battle_log`.
 *
 * Winners: team modes store the winning TEAM id in `winner_id`, so the side
 * comes from `winning_side` first (same rule as `resolveSideOutcome` in
 * `services/dashboard/cycleProgressService.ts`), then from the winner robot's
 * team; neither means a draw.
 */
import { classifyForfeit } from '../../match/matchHistoryService';
import { modeShape, timeLimitFor } from './battleModes';

export type BattleResult = 'win' | 'draw' | 'bye' | 'forfeit';

export type EndedBy =
  | 'destroyed'
  | 'yield'
  | 'team_eliminated'
  | 'time_limit'
  | 'score_reached'
  | 'last_standing';

export interface OutcomeParticipant {
  robotId: number;
  team: number;
  destroyed: boolean;
  yielded: boolean;
  forfeited: boolean;
}

export interface OutcomeInput {
  battleType: string;
  winnerId: number | null;
  winningSide: number | null;
  durationSeconds: number;
  participants: readonly OutcomeParticipant[];
  isBye: boolean;
  /** `tournament_matches.status = 'forfeit'` for this battle. */
  isForfeitTournamentBattle: boolean;
  /** KotH only: the winner's zone score and the match's score threshold, from `battle_summaries`. */
  koth?: { winnerZoneScore: number | null; scoreThreshold: number | null } | null;
}

export interface BattleOutcome {
  result: BattleResult;
  /** 1 or 2 for two-sided modes; null for draws and placement modes. */
  winningSide: 1 | 2 | null;
  /** The winning robot in 1v1 and placement modes; null in team modes (the winner is a team). */
  winnerRobotId: number | null;
  endedBy: EndedBy | null;
  forfeitedRobotIds: number[];
}

const isOut = (p: OutcomeParticipant): boolean => p.destroyed || p.yielded || p.forfeited;

function toSide(value: number | null | undefined): 1 | 2 | null {
  return value === 1 || value === 2 ? value : null;
}

function resolveWinningSide(input: OutcomeInput): 1 | 2 | null {
  const fromColumn = toSide(input.winningSide);
  if (fromColumn !== null) return fromColumn;
  if (input.winnerId === null) return null;
  return toSide(input.participants.find(p => p.robotId === input.winnerId)?.team);
}

function placementEndedBy(input: OutcomeInput): EndedBy {
  const threshold = input.koth?.scoreThreshold ?? null;
  const winnerScore = input.koth?.winnerZoneScore ?? null;
  if (input.battleType === 'koth' && threshold !== null && threshold > 0 && winnerScore !== null && winnerScore >= threshold) {
    return 'score_reached';
  }
  const survivors = input.participants.filter(p => !isOut(p)).length;
  return survivors <= 1 ? 'last_standing' : 'time_limit';
}

function twoSidedEndedBy(input: OutcomeInput, winningSide: 1 | 2 | null): EndedBy | null {
  const atLimit = input.durationSeconds >= timeLimitFor(input.battleType);
  const isDuel = modeShape(input.battleType) === 'duel';

  if (winningSide === null) {
    if (atLimit) return 'time_limit';
    if (input.participants.length > 0 && input.participants.every(isOut)) {
      return isDuel ? 'destroyed' : 'team_eliminated';
    }
    return null;
  }

  const losers = input.participants.filter(p => p.team !== winningSide);
  if (isDuel) {
    if (losers.some(p => p.destroyed)) return 'destroyed';
    if (losers.some(p => p.yielded)) return 'yield';
    return atLimit ? 'time_limit' : null;
  }
  if (losers.length > 0 && losers.every(isOut)) return 'team_eliminated';
  return atLimit ? 'time_limit' : null;
}

export function classifyBattleOutcome(input: OutcomeInput): BattleOutcome {
  const { isForfeit, forfeitedRobotIds } = classifyForfeit(
    input.battleType,
    input.participants,
    input.isForfeitTournamentBattle,
  );
  const shape = modeShape(input.battleType);

  if (shape === 'placement') {
    const winnerRobotId = input.winnerId;
    if (input.isBye) return { result: 'bye', winningSide: null, winnerRobotId, endedBy: null, forfeitedRobotIds };
    if (isForfeit) return { result: 'forfeit', winningSide: null, winnerRobotId, endedBy: null, forfeitedRobotIds };
    if (winnerRobotId === null) return { result: 'draw', winningSide: null, winnerRobotId: null, endedBy: placementEndedBy(input), forfeitedRobotIds };
    return { result: 'win', winningSide: null, winnerRobotId, endedBy: placementEndedBy(input), forfeitedRobotIds };
  }

  const winningSide = resolveWinningSide(input);
  const winnerRobotId = shape === 'duel' && input.winnerId !== null
    && input.participants.some(p => p.robotId === input.winnerId)
    ? input.winnerId
    : null;

  if (input.isBye) return { result: 'bye', winningSide, winnerRobotId, endedBy: null, forfeitedRobotIds };
  if (isForfeit) return { result: 'forfeit', winningSide, winnerRobotId, endedBy: null, forfeitedRobotIds };

  const decided = winningSide !== null || input.winnerId !== null;
  return {
    result: decided ? 'win' : 'draw',
    winningSide,
    winnerRobotId,
    endedBy: twoSidedEndedBy(input, winningSide),
    forfeitedRobotIds,
  };
}

/**
 * Largest absolute ELO change among the participants of a fought two-sided
 * battle. Null for placement modes (they don't move ELO), byes, forfeits and
 * battles whose participant rows are gone.
 */
export function eloSwing(
  battleType: string,
  result: BattleResult,
  participants: ReadonlyArray<{ eloBefore: number; eloAfter: number }>,
): number | null {
  if (modeShape(battleType) === 'placement' || result === 'bye' || result === 'forfeit' || participants.length === 0) {
    return null;
  }
  let swing = 0;
  for (const p of participants) swing = Math.max(swing, Math.abs(p.eloAfter - p.eloBefore));
  return swing;
}
