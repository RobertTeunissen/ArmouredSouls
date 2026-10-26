/**
 * Turn fought battles into paired comparisons ("side A beat side B") for the
 * "what wins" models.
 *
 * - 1v1 and team modes: side 1 vs side 2; the winner comes from the admin
 *   Battles outcome rule (`winning_side`, then `winner_id`, else draw).
 * - King of the Hill and Grand Melee: pairs of robots with different
 *   placements, the better placement winning. Each battle weighs n/2 in total
 *   (every robot counts once), spread over its pairs; Grand Melee fields are
 *   sampled to at most `PLACEMENT_PAIR_CAP` pairs per battle.
 *
 * Draws, tied placements, byes and forfeits are skipped and counted. A side
 * without any recorded build (recording started mid-battle, a deleted record)
 * skips the comparison.
 */
import { classifyBattleOutcome } from '../battles/battleOutcome';
import { modeShape } from '../battles/battleModes';
import { MODE_COLUMN, type AnalysisColumn } from './analysisOptions';
import type { LayeredBuild } from './attributeLayers';

export const PLACEMENT_PAIR_CAP = 30;

export interface AnalysisParticipant {
  robotId: number;
  team: number;
  placement: number | null;
  forfeited: boolean;
  destroyed: boolean;
  yielded: boolean;
  /** `users.stable_type` of the robot's stable; null when the robot is gone. */
  stableType: string | null;
  build: LayeredBuild | null;
}

export interface AnalysisBattle {
  battleId: number;
  battleType: string;
  winnerId: number | null;
  winningSide: number | null;
  durationSeconds: number;
  participants: AnalysisParticipant[];
}

export type ModeColumn = Exclude<AnalysisColumn, 'all'>;

export interface Comparison {
  battleId: number;
  column: ModeColumn;
  a: LayeredBuild[];
  b: LayeredBuild[];
  /** 1 = side A won. */
  y: 0 | 1;
  w: number;
}

/** One robot that fought, for usage shares. */
export interface Appearance {
  column: ModeColumn;
  build: LayeredBuild;
  human: boolean;
}

export interface SkipCounts {
  draws: number;
  tiedPlacements: number;
  forfeits: number;
  missingBuilds: number;
}

export interface ComparisonSet {
  comparisons: Comparison[];
  appearances: Appearance[];
  battles: Record<ModeColumn, number>;
  skipped: SkipCounts;
}

/** Deterministic PRNG (mulberry32) seeded by battle id. */
function prng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function placementPairs(n: number, random: () => number): Array<[number, number]> {
  const all: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) all.push([i, j]);
  if (all.length <= PLACEMENT_PAIR_CAP) return all;
  // Partial Fisher-Yates: the first PLACEMENT_PAIR_CAP entries are a uniform sample.
  for (let i = 0; i < PLACEMENT_PAIR_CAP; i++) {
    const j = i + Math.floor(random() * (all.length - i));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, PLACEMENT_PAIR_CAP);
}

function addPlacementBattle(battle: AnalysisBattle, column: ModeColumn, set: ComparisonSet): boolean {
  const field = battle.participants.filter((p) => !p.forfeited && p.build !== null && p.placement !== null);
  if (field.length < 2) {
    set.skipped.missingBuilds++;
    return false;
  }
  const random = prng(battle.battleId);
  const pairs = placementPairs(field.length, random);
  const weight = field.length / 2 / pairs.length;
  let added = 0;
  for (const [i, j] of pairs) {
    const pi = field[i];
    const pj = field[j];
    if (pi.placement === pj.placement) {
      set.skipped.tiedPlacements++;
      continue;
    }
    const iBetter = (pi.placement as number) < (pj.placement as number);
    // Random orientation, so side A is not always the winner.
    const swap = random() < 0.5;
    const a = swap ? pj : pi;
    const b = swap ? pi : pj;
    const aWon = swap ? !iBetter : iBetter;
    set.comparisons.push({ battleId: battle.battleId, column, a: [a.build as LayeredBuild], b: [b.build as LayeredBuild], y: aWon ? 1 : 0, w: weight });
    added++;
  }
  return added > 0;
}

function addTwoSidedBattle(battle: AnalysisBattle, column: ModeColumn, set: ComparisonSet): boolean {
  const outcome = classifyBattleOutcome({
    battleType: battle.battleType,
    winnerId: battle.winnerId,
    winningSide: battle.winningSide,
    durationSeconds: battle.durationSeconds,
    participants: battle.participants,
    isBye: false,
    isForfeitTournamentBattle: false,
  });
  if (outcome.result === 'forfeit' || outcome.result === 'bye') {
    set.skipped.forfeits++;
    return false;
  }
  if (outcome.result === 'draw' || outcome.winningSide === null) {
    set.skipped.draws++;
    return false;
  }
  const side = (team: number): LayeredBuild[] =>
    battle.participants.filter((p) => p.team === team && p.build !== null).map((p) => p.build as LayeredBuild);
  const a = side(1);
  const b = side(2);
  if (a.length === 0 || b.length === 0) {
    set.skipped.missingBuilds++;
    return false;
  }
  set.comparisons.push({ battleId: battle.battleId, column, a, b, y: outcome.winningSide === 1 ? 1 : 0, w: 1 });
  return true;
}

export function emptyComparisonSet(): ComparisonSet {
  return {
    comparisons: [],
    appearances: [],
    battles: { duel: 0, team: 0, multi: 0 },
    skipped: { draws: 0, tiedPlacements: 0, forfeits: 0, missingBuilds: 0 },
  };
}

/** Add one battle's comparisons and appearances to `set`. Unknown battle types are ignored. */
export function addBattle(battle: AnalysisBattle, set: ComparisonSet): void {
  const column = MODE_COLUMN[battle.battleType];
  if (!column) return;
  let used: boolean;
  if (modeShape(battle.battleType) !== 'placement') {
    used = addTwoSidedBattle(battle, column, set);
  } else if (battle.participants.length > 0 && battle.participants.every((p) => p.forfeited)) {
    set.skipped.forfeits++;
    used = false;
  } else {
    used = addPlacementBattle(battle, column, set);
  }
  if (!used) return;
  set.battles[column]++;
  for (const p of battle.participants) {
    if (p.build && !p.forfeited) set.appearances.push({ column, build: p.build, human: p.stableType === 'human' });
  }
}
