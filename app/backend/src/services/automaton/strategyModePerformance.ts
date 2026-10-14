/**
 * Per-mode strategy performance for the Strategy_Comparison (admin Automatons
 * page): one entry per tiered mode per strategy row, read from `standings`
 * only (never `battle_log`), played rows only. Current season only, because
 * `standings` is wiped at season purge.
 *
 * Head-to-head modes (`league_1v1`, `league_2v2`, `league_3v3`, `tag_team`)
 * count W + L + D. Placement modes (`koth`, `grand_melee`) count
 * `total_matches`; `wins` are first places and losses/draws are never written,
 * so only first places, matches and the best placement are meaningful there.
 * Human_Stables group under strategy key null (the reference row).
 */
import { Prisma } from '../../../generated/prisma';
import {
  isLowSample,
  isTieredMode,
  PLACEMENT_STANDINGS_MODES,
  TEAM_STANDINGS_MODES,
  TIERED_STANDINGS_MODES,
  type TieredStandingsMode,
} from '../../shared/utils/automatonStandingsTier';
import { PLAYED_STANDING_SQL, TIERED_MODE_SQL } from './standingsTier';

export interface ModePerformance {
  mode: TieredStandingsMode;
  /** placement = koth, grand_melee. */
  kind: 'head_to_head' | 'placement';
  /** team = league_2v2, league_3v3, tag_team. */
  entityType: 'robot' | 'team';
  /** Distinct stables with at least one played row in the mode. */
  stablesPlayed: number;
  /** Robots or teams with a played row. */
  entitiesPlayed: number;
  /** Placement modes: first places. */
  wins: number;
  /** Placement modes: always 0 (not recorded). */
  losses: number;
  /** Placement modes: always 0 (not recorded). */
  draws: number;
  /** head_to_head: W + L + D; placement: SUM(total_matches). */
  matches: number;
  /** wins ÷ matches × 100, one decimal; null when matches = 0. */
  winPercentage: number | null;
  /** Placement modes: MIN(best_placement); head_to_head: null. */
  bestPlacement: number | null;
  lowSample: boolean;
}

/** One grouped row of `readModeAggregates`: a strategy (null = Human_Stables) in one mode. */
export interface ModeAggregate {
  strategyKey: string | null;
  mode: TieredStandingsMode;
  stables: number;
  entities: number;
  wins: number;
  losses: number;
  draws: number;
  placementMatches: number;
  bestPlacement: number | null;
}

/** Win percentage: one decimal, null with no matches (never divides by zero). */
export function winPercentage(wins: number, total: number): number | null {
  return total === 0 ? null : Math.round((wins / total) * 1000) / 10;
}

interface ModeAggregateRow {
  strategy_key: string | null;
  mode: string;
  stables: number;
  entities: number;
  wins: number;
  losses: number;
  draws: number;
  placement_matches: number;
  best_placement: number | null;
}

/**
 * Played standings per strategy and mode: one grouped query over `standings`
 * ⨝ `robots` / `team_battles` ⨝ `users` ⟕ active `automaton_profiles`.
 */
export async function readModeAggregates(db: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<ModeAggregate[]> {
  const rows = await db.$queryRaw<ModeAggregateRow[]>`
    WITH "owned" AS (
      SELECT r."user_id" AS "owner_id", s."mode"::text AS "mode", s."wins", s."losses", s."draws", s."total_matches", s."best_placement"
      FROM "standings" s JOIN "robots" r ON s."entity_type" = 'robot' AND r."id" = s."entity_id"
      WHERE ${TIERED_MODE_SQL} AND ${PLAYED_STANDING_SQL}
      UNION ALL
      SELECT t."stable_id", s."mode"::text, s."wins", s."losses", s."draws", s."total_matches", s."best_placement"
      FROM "standings" s JOIN "team_battles" t ON s."entity_type" = 'team' AND t."id" = s."entity_id"
      WHERE ${TIERED_MODE_SQL} AND ${PLAYED_STANDING_SQL}
    )
    SELECT ap."strategy_key", o."mode",
           COUNT(DISTINCT o."owner_id")::int AS "stables", COUNT(*)::int AS "entities",
           SUM(o."wins")::int AS "wins", SUM(o."losses")::int AS "losses", SUM(o."draws")::int AS "draws",
           SUM(COALESCE(o."total_matches", 0))::int AS "placement_matches",
           MIN(o."best_placement")::int AS "best_placement"
    FROM "owned" o
    JOIN "users" u ON u."id" = o."owner_id"
    LEFT JOIN "automaton_profiles" ap ON ap."user_id" = u."id" AND ap."status" = 'active'
    WHERE ap."strategy_key" IS NOT NULL OR u."stable_type" = 'human'
    GROUP BY ap."strategy_key", o."mode"`;
  return rows.flatMap((row): ModeAggregate[] => {
    if (!isTieredMode(row.mode)) return [];
    return [{
      strategyKey: row.strategy_key,
      mode: row.mode,
      stables: Number(row.stables),
      entities: Number(row.entities),
      wins: Number(row.wins),
      losses: Number(row.losses),
      draws: Number(row.draws),
      placementMatches: Number(row.placement_matches),
      bestPlacement: row.best_placement === null ? null : Number(row.best_placement),
    }];
  });
}

/** Six entries in `TIERED_STANDINGS_MODES` order for one strategy key (null = reference row), zero-filled. */
export function buildModePerformance(aggregates: readonly ModeAggregate[], strategyKey: string | null): ModePerformance[] {
  const byMode = new Map(aggregates.filter((a) => a.strategyKey === strategyKey).map((a) => [a.mode, a]));
  return TIERED_STANDINGS_MODES.map((mode): ModePerformance => {
    const placement = PLACEMENT_STANDINGS_MODES.includes(mode);
    const aggregate = byMode.get(mode);
    const stablesPlayed = aggregate?.stables ?? 0;
    const wins = aggregate?.wins ?? 0;
    const losses = placement ? 0 : aggregate?.losses ?? 0;
    const draws = placement ? 0 : aggregate?.draws ?? 0;
    const matches = placement ? aggregate?.placementMatches ?? 0 : wins + losses + draws;
    return {
      mode,
      kind: placement ? 'placement' : 'head_to_head',
      entityType: TEAM_STANDINGS_MODES.includes(mode) ? 'team' : 'robot',
      stablesPlayed,
      entitiesPlayed: aggregate?.entities ?? 0,
      wins,
      losses,
      draws,
      matches,
      winPercentage: winPercentage(wins, matches),
      bestPlacement: placement ? aggregate?.bestPlacement ?? null : null,
      lowSample: isLowSample(stablesPlayed, matches),
    };
  });
}
