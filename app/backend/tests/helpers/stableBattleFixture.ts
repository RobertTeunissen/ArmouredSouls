/**
 * In-memory battle fixture for stable-total unit tests.
 *
 * Describes battles once and derives both inputs the stable-total services
 * read: the per-robot career counters (as the orchestrators write them, one
 * update per member) and the shared-side rows the overlap SQL returns. A test
 * can then assert that a stable's totals count each battle once, without
 * hand-computing either side.
 *
 * The shared-side derivation is a TypeScript copy of the WHERE / GROUP BY /
 * HAVING of `getStableBattleOverlapsByUser`; it does not run that SQL. The SQL
 * text and bound values are pinned in `stableBattleOverlap.test.ts` (unit tier,
 * mocked). The query itself runs against a real database in one integration
 * case only: `tests/userStableStats.test.ts` (one same-stable tag-team side,
 * the batch result and the archived stable total). The cases built from this
 * fixture (byes, 2v2/3v3, cross-stable pairs, placement modes) are covered at
 * unit level only.
 */
import { NO_COUNTER_BYE_BATTLE_TYPES } from '../../src/services/auth/stable-battle-overlap';
import { PLACEMENT_COUNTED_MODES } from '../../src/services/robot/all-modes-battle-count';

export interface FixtureParticipant {
  robotId: number;
  userId: number;
  team: number;
}

export interface FixtureBattle {
  id: number;
  battleType: string;
  winnerId: number | null;
  winningSide: number | null;
  participants: FixtureParticipant[];
}

export interface RobotCounters {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface FixtureSharedSide {
  userId: number;
  battleId: number;
  team: number;
  robotCount: number;
  winnerId: number | null;
  winningSide: number | null;
}

const PLACEMENT_TYPES: readonly string[] = [...PLACEMENT_COUNTED_MODES];

function isBye(battle: FixtureBattle): boolean {
  return new Set(battle.participants.map((p) => p.team)).size < 2;
}

/** Whether the battle touched the robot counters at all. */
function touchesCounters(battle: FixtureBattle): boolean {
  if (PLACEMENT_TYPES.includes(battle.battleType)) return false;
  if (NO_COUNTER_BYE_BATTLE_TYPES.includes(battle.battleType) && isBye(battle)) return false;
  return true;
}

function outcomeFor(battle: FixtureBattle, p: FixtureParticipant): 'win' | 'loss' | 'draw' {
  if (battle.winningSide === 1 || battle.winningSide === 2) {
    return battle.winningSide === p.team ? 'win' : 'loss';
  }
  if (battle.winnerId === null) return 'draw';
  return battle.winnerId === p.robotId ? 'win' : 'loss';
}

/** Per-robot counters as `updateRobotCombatStats` leaves them: +1 per member. */
export function robotCountersFrom(battles: readonly FixtureBattle[]): Map<number, RobotCounters> {
  const counters = new Map<number, RobotCounters>();
  for (const battle of battles) {
    if (!touchesCounters(battle)) continue;
    for (const p of battle.participants) {
      const c = counters.get(p.robotId) ?? { totalBattles: 0, wins: 0, losses: 0, draws: 0 };
      c.totalBattles += 1;
      const outcome = outcomeFor(battle, p);
      if (outcome === 'win') c.wins += 1;
      else if (outcome === 'loss') c.losses += 1;
      else c.draws += 1;
      counters.set(p.robotId, c);
    }
  }
  return counters;
}

/** The rows the batch overlap query returns for these stables. */
export function sharedSidesFrom(battles: readonly FixtureBattle[], userIds: readonly number[]): FixtureSharedSide[] {
  const rows: FixtureSharedSide[] = [];
  for (const battle of battles) {
    if (!touchesCounters(battle)) continue;
    const counts = new Map<string, FixtureSharedSide>();
    for (const p of battle.participants) {
      if (!userIds.includes(p.userId)) continue;
      const key = `${p.userId}:${p.team}`;
      const row = counts.get(key) ?? {
        userId: p.userId,
        battleId: battle.id,
        team: p.team,
        robotCount: 0,
        winnerId: battle.winnerId,
        winningSide: battle.winningSide,
      };
      row.robotCount += 1;
      counts.set(key, row);
    }
    rows.push(...[...counts.values()].filter((row) => row.robotCount > 1));
  }
  return rows;
}
