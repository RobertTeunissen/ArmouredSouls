/**
 * Stable battle overlap: the correction that turns per-robot career counters
 * into per-stable totals.
 *
 * `robots.total_battles / wins / losses / draws` are per-robot. Every team-mode
 * orchestrator (tag team active and reserve, 2v2/3v3 League, 2v2/3v3 tournament)
 * and every team bye that updates ELO calls `updateRobotCombatStats` once per
 * member, so one battle fought by k robots of the same stable adds k to the sum
 * of that stable's counters. The stable played it once.
 *
 * The overlap is the surplus: for every (battle, side) where the stable fielded
 * k > 1 robots, k - 1 battles, filed under the side's single outcome. Stable
 * totals = sum of robot counters - overlap. Per-robot counters are untouched,
 * and byes keep counting exactly as the robot counters count them (once per
 * stable, as a win).
 *
 * Opposite sides are separate: two of the stable's teams meeting in a tournament
 * still contribute one win and one loss, as they do in the robot counters.
 *
 * Rows that never touched the counters are left out, so nothing is subtracted
 * that was not added:
 * - Placement modes (KotH, Grand Melee) pass `skipBattleCounters: true`.
 * - Byes of modes whose Bye_Mode_Table entry has `updatesElo: false` (team
 *   tournament byes) never call `updateRobotCombatStats`. A bye row has only
 *   the real side's participants, so they are the rows without an opposing side.
 * - A legacy team row with a `winner_id` but no `winning_side` (pre-Spec #39)
 *   has no readable shared outcome; it is left as the robot counters have it.
 *   The outcome is never read from the ephemeral `battle_log`.
 */
import prisma from '../../lib/prisma';
import { BYE_MODES, BYE_MODE_SPECS } from '../../utils/byeRewards';
import { PLACEMENT_COUNTED_MODES } from '../robot/all-modes-battle-count';

/** One side of one battle on which the stable fielded `robotCount` robots. */
export interface SharedSideGroup {
  battleId: number;
  team: number;
  robotCount: number;
  winnerId: number | null;
  winningSide: number | null;
}

export interface StableBattleOverlap {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
}

export type SharedSideOutcome = 'win' | 'loss' | 'draw' | 'unknown';

/** Battle types that never touch the robot counters, whatever the row. */
const NO_COUNTER_BATTLE_TYPES: readonly string[] = [...PLACEMENT_COUNTED_MODES];

/** Bye modes whose bye rows never touch the robot counters (`updatesElo: false`). */
export const NO_COUNTER_BYE_BATTLE_TYPES: readonly string[] = BYE_MODES.filter(
  (mode) => !BYE_MODE_SPECS[mode].updatesElo && !NO_COUNTER_BATTLE_TYPES.includes(mode),
);

/** Outcome of a side, from the permanent `battles` columns only. */
export function classifySharedSideOutcome(
  group: Pick<SharedSideGroup, 'team' | 'winnerId' | 'winningSide'>,
): SharedSideOutcome {
  if (group.winningSide === 1 || group.winningSide === 2) {
    return group.winningSide === group.team ? 'win' : 'loss';
  }
  if (group.winnerId === null) return 'draw';
  return 'unknown';
}

/** Sum the surplus (k - 1) of every shared side, by outcome. */
export function computeStableBattleOverlap(groups: readonly SharedSideGroup[]): StableBattleOverlap {
  const overlap: StableBattleOverlap = { battles: 0, wins: 0, losses: 0, draws: 0 };

  for (const group of groups) {
    const surplus = group.robotCount - 1;
    if (surplus <= 0) continue;

    const outcome = classifySharedSideOutcome(group);
    if (outcome === 'unknown') continue;

    overlap.battles += surplus;
    if (outcome === 'win') overlap.wins += surplus;
    else if (outcome === 'loss') overlap.losses += surplus;
    else overlap.draws += surplus;
  }

  return overlap;
}

/**
 * Read the stable's shared sides and return the overlap to subtract from the
 * summed robot counters. One query; empty input issues none.
 */
export async function getStableBattleOverlap(robotIds: readonly number[]): Promise<StableBattleOverlap> {
  const ids = Array.from(new Set(robotIds));
  if (ids.length === 0) return { battles: 0, wins: 0, losses: 0, draws: 0 };

  const groups = await prisma.$queryRaw<SharedSideGroup[]>`
    SELECT
      bp.battle_id AS "battleId",
      bp.team AS "team",
      COUNT(*)::int AS "robotCount",
      b.winner_id AS "winnerId",
      b.winning_side::int AS "winningSide"
    FROM battle_participants bp
    JOIN battles b ON b.id = bp.battle_id
    WHERE bp.robot_id = ANY(${ids})
      AND b.battle_type <> ALL(${[...NO_COUNTER_BATTLE_TYPES]})
      -- A bye in these modes has no opposing side and never touched the counters.
      AND NOT (
        b.battle_type = ANY(${[...NO_COUNTER_BYE_BATTLE_TYPES]})
        AND NOT EXISTS (
          SELECT 1 FROM battle_participants opp
          WHERE opp.battle_id = bp.battle_id AND opp.team <> bp.team
        )
      )
    GROUP BY bp.battle_id, bp.team, b.winner_id, b.winning_side
    HAVING COUNT(*) > 1
  `;

  return computeStableBattleOverlap(groups);
}
