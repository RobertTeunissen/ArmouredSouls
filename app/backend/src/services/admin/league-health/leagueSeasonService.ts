/**
 * League Health "This season" for one mode and stable type: promotions and
 * demotions per cycle, cycles in which the mode recorded no moves, and per tier
 * boundary the moves and the bounce-back share (promoted, then demoted back
 * across the same boundary within `LEAGUE_BOUNCE_WINDOW_CYCLES`).
 *
 * Source: `league_history` (emptied at season rollover, so it is this season).
 * The mode's cycle range and its quiet cycles are taken over all stables, so a
 * stable-type filter shows zeros, not gaps, where the mode did rebalance.
 *
 * @module services/admin/league-health/leagueSeasonService
 */

import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { LEAGUE_TIERS } from '../../league/leagueInstanceService';
import type { TieredLeagueMode } from '../../league/league-rules';
import { LEAGUE_BOUNCE_MIN_SAMPLE, LEAGUE_BOUNCE_NOTE_SHARE, LEAGUE_BOUNCE_WINDOW_CYCLES } from '../adminThresholds';
import type {
  LeagueSeasonOverview,
  LeagueSeasonStableFilter,
  SeasonBoundary,
  SeasonCycleMoves,
} from '../../../shared/types';

export const LEAGUE_SEASON_STABLE_FILTERS = ['all', 'human', 'automaton', 'generated'] as const satisfies readonly LeagueSeasonStableFilter[];
interface RawMove {
  cycle_number: number;
  change_type: string;
  source_tier: string;
  destination_tier: string;
  moved: number;
}

interface RawBounce {
  source_tier: string;
  judged: number;
  back: number;
}

function stableClause(stable: LeagueSeasonStableFilter): Prisma.Sql {
  return stable === 'all' ? Prisma.empty : Prisma.sql`AND u.stable_type::text = ${stable}`;
}

/** Pure assembly from grouped rows (exported for tests). */
export function buildLeagueSeason(
  mode: TieredLeagueMode,
  stable: LeagueSeasonStableFilter,
  modeCycles: readonly number[],
  moves: readonly RawMove[],
  bounces: readonly RawBounce[],
): LeagueSeasonOverview {
  const sortedCycles = [...new Set(modeCycles)].sort((a, b) => a - b);
  const firstCycle = sortedCycles[0] ?? null;
  const lastCycle = sortedCycles[sortedCycles.length - 1] ?? null;
  const present = new Set(sortedCycles);

  const perCycle = new Map<number, SeasonCycleMoves>();
  const cycles: SeasonCycleMoves[] = [];
  const quietCycles: number[] = [];
  if (firstCycle !== null && lastCycle !== null) {
    for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
      const entry = { cycle, promoted: 0, demoted: 0 };
      perCycle.set(cycle, entry);
      cycles.push(entry);
      if (!present.has(cycle)) quietCycles.push(cycle);
    }
  }

  const promotedOut = new Map<string, number>();
  const demotedOut = new Map<string, number>();
  let promoted = 0;
  let demoted = 0;
  for (const move of moves) {
    const count = Number(move.moved);
    const entry = perCycle.get(move.cycle_number);
    if (move.change_type === 'promotion') {
      promoted += count;
      if (entry) entry.promoted += count;
      promotedOut.set(move.source_tier, (promotedOut.get(move.source_tier) ?? 0) + count);
    } else if (move.change_type === 'demotion') {
      demoted += count;
      if (entry) entry.demoted += count;
      demotedOut.set(move.source_tier, (demotedOut.get(move.source_tier) ?? 0) + count);
    }
  }

  const bounceByTier = new Map(bounces.map((row) => [row.source_tier, row]));
  const boundaries: SeasonBoundary[] = LEAGUE_TIERS.slice(0, -1).map((lower, index) => {
    const upper = LEAGUE_TIERS[index + 1];
    const bounce = bounceByTier.get(lower);
    const judged = Number(bounce?.judged ?? 0);
    const back = Number(bounce?.back ?? 0);
    const share = judged > 0 ? back / judged : null;
    return {
      lower,
      upper,
      promoted: promotedOut.get(lower) ?? 0,
      demoted: demotedOut.get(upper) ?? 0,
      judged,
      back,
      share,
      noted: share !== null && judged >= LEAGUE_BOUNCE_MIN_SAMPLE && share > LEAGUE_BOUNCE_NOTE_SHARE,
    };
  });

  const judgedThroughCycle = lastCycle !== null && lastCycle - LEAGUE_BOUNCE_WINDOW_CYCLES >= (firstCycle ?? 0)
    ? lastCycle - LEAGUE_BOUNCE_WINDOW_CYCLES
    : null;

  return {
    mode,
    stable,
    window: LEAGUE_BOUNCE_WINDOW_CYCLES,
    noteShare: LEAGUE_BOUNCE_NOTE_SHARE,
    minSample: LEAGUE_BOUNCE_MIN_SAMPLE,
    firstCycle,
    lastCycle,
    judgedThroughCycle,
    cycles,
    quietCycles,
    totals: { promoted, demoted },
    boundaries,
  };
}

/** Read this season's moves of one mode for one stable type. */
export async function getLeagueSeason(
  mode: TieredLeagueMode,
  stable: LeagueSeasonStableFilter,
): Promise<LeagueSeasonOverview> {
  const modeCycleRows = await prisma.$queryRaw<{ cycle_number: number }[]>`
    SELECT DISTINCT cycle_number FROM league_history WHERE mode = ${mode}
  `;
  const modeCycles = modeCycleRows.map((row) => row.cycle_number);
  const lastCycle = modeCycles.length > 0 ? Math.max(...modeCycles) : null;
  const judgedThrough = lastCycle === null ? null : lastCycle - LEAGUE_BOUNCE_WINDOW_CYCLES;

  const [moves, bounces] = await Promise.all([
    prisma.$queryRaw<RawMove[]>`
      SELECT h.cycle_number, h.change_type, h.source_tier, h.destination_tier, COUNT(*)::int AS moved
      FROM league_history h
      JOIN users u ON u.id = h.user_id
      WHERE h.mode = ${mode} ${stableClause(stable)}
      GROUP BY h.cycle_number, h.change_type, h.source_tier, h.destination_tier
    `,
    judgedThrough === null
      ? Promise.resolve([] as RawBounce[])
      : prisma.$queryRaw<RawBounce[]>`
        SELECT p.source_tier,
          COUNT(*)::int AS judged,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM league_history d
            WHERE d.change_type = 'demotion' AND d.mode = p.mode
              AND d.entity_type = p.entity_type AND d.entity_id = p.entity_id
              AND d.source_tier = p.destination_tier AND d.destination_tier = p.source_tier
              AND d.cycle_number > p.cycle_number AND d.cycle_number <= p.cycle_number + ${LEAGUE_BOUNCE_WINDOW_CYCLES}
          ))::int AS back
        FROM league_history p
        JOIN users u ON u.id = p.user_id
        WHERE p.mode = ${mode} AND p.change_type = 'promotion' AND p.cycle_number <= ${judgedThrough} ${stableClause(stable)}
        GROUP BY p.source_tier
      `,
  ]);

  return buildLeagueSeason(mode, stable, modeCycles, moves, bounces);
}
