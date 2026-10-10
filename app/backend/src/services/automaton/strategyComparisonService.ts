/**
 * Strategy_Comparison (Spec #55, R11.13, R11.14, design §17.3, task 9.7).
 *
 * Current season only: `battles`, `battle_participants` and `standings` hold
 * only the current season (purged at rollover), so no season filter is
 * needed on them. One row per Upgrade_Strategy with at least one
 * Active_Automaton, plus a Human_Stable reference row when at least one
 * Human_Stable owns a robot.
 *
 * Battle-mode mapping (confirmed against the orchestrators and the battle
 * history queries): `battles.battle_type` is `league_1v1`, `tournament_1v1`,
 * `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3` or
 * `tag_team` for the seven head-to-head modes; `koth` and `grand_melee` are
 * excluded. The 1v1 modes store the winning robot in `winner_id` (null on a
 * draw); the team modes store the winning `team` in `winning_side` (null on a
 * draw). A bye stores participants on one side only (the bye robot has no
 * row), so the two-sides rule excludes it.
 *
 * Reads `battles` and `battle_participants` columns only — never
 * `battle_log` — and `standings` for the best tier. Cached for 60 seconds.
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import { getCurrentSeason } from '../season/seasonService';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import { highestRobotsTarget } from './strategies/strategyParameters';
import type { StrategyRegistry } from './strategies/registry';
import { storedParameters } from './automatonProfileRules';
import { bestTiersForUsers, LEAGUE_TIER_ORDER, type LeagueTier } from './standingsTier';

/** The seven head-to-head modes of R11.13, as stored in `battles.battle_type`. */
export const HEAD_TO_HEAD_BATTLE_TYPES = [
  'league_1v1',
  'tournament_1v1',
  'league_2v2',
  'tournament_2v2',
  'league_3v3',
  'tournament_3v3',
  'tag_team',
] as const;

/** Modes whose winner is a robot (`winner_id`); the others use `winning_side`. */
export const ONE_VS_ONE_BATTLE_TYPES = ['league_1v1', 'tournament_1v1'] as const;

export const COMPARISON_CACHE_TTL_MS = 60_000;

export const HUMAN_REFERENCE_LABEL = 'Human stables (reference)';

export interface WinRate {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  /** wins ÷ total × 100, one decimal; null with 0 head-to-head battles. */
  percentage: number | null;
}

export interface ComparisonRow {
  /** The strategy key; null on the reference row. */
  strategyKey: string | null;
  displayName: string;
  reference: boolean;
  stables: number;
  robots: { average: number; targetAverage: number | null };
  prestigeAverage: number;
  /** The highest tier any robot or team holds, with the number of stables whose own best equals it. */
  bestTier: { tier: LeagueTier; stables: number } | null;
  creditsAverage: number;
  /** Null on the reference row. */
  winRate: WinRate | null;
}

export interface StrategyComparison {
  season: {
    seasonNumber: number;
    phase: string;
    /** 1-based competitive cycle; 0 while preparing. */
    cycle: number;
    lengthCycles: number;
    preparationDay: number;
  };
  rows: ComparisonRow[];
  generatedAt: string;
}

/** The read client: the singleton, or a transaction (tests isolate the shared dev database this way). */
export type ComparisonDb = Pick<Prisma.TransactionClient, '$queryRaw' | 'automatonProfile' | 'robot' | 'teamBattle' | 'standing'>;

export interface StrategyComparisonDeps {
  registry?: StrategyRegistry;
  db?: ComparisonDb;
}

// ── Pure helpers ─────────────────────────────────────────────────────

function average(values: readonly number[], decimals = 1): number {
  if (values.length === 0) return 0;
  const factor = 10 ** decimals;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * factor) / factor;
}

/** Win percentage: one decimal, null with no battles (never divides by zero). */
export function winPercentage(wins: number, total: number): number | null {
  return total === 0 ? null : Math.round((wins / total) * 1000) / 10;
}

/** The best tier over stables' own best tiers and how many stables hold it. */
export function bestTierOf(tiers: readonly (LeagueTier | null)[]): { tier: LeagueTier; stables: number } | null {
  let best = -1;
  let count = 0;
  for (const tier of tiers) {
    if (tier === null) continue;
    const rank = LEAGUE_TIER_ORDER.indexOf(tier);
    if (rank > best) {
      best = rank;
      count = 1;
    } else if (rank === best) {
      count++;
    }
  }
  return best < 0 ? null : { tier: LEAGUE_TIER_ORDER[best], stables: count };
}

// ── Queries ──────────────────────────────────────────────────────────

interface WinRateRow {
  strategy_key: string;
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Head-to-head results per strategy (R11.13, R11.14): one aggregate over
 * `battles` ⨝ `battle_participants` ⨝ `robots` ⨝ `users`. A battle counts when
 * it has exactly two sides, one side's owners are all Automatons of one
 * strategy and the other side's owners are all Human_Stables.
 */
async function readWinRates(db: ComparisonDb): Promise<Map<string, WinRate>> {
  const modes = Prisma.join([...HEAD_TO_HEAD_BATTLE_TYPES]);
  const oneVsOne = Prisma.join([...ONE_VS_ONE_BATTLE_TYPES]);
  const rows = await db.$queryRaw<WinRateRow[]>`
    WITH "sides" AS (
      SELECT b."id" AS "battle_id", b."battle_type", b."winner_id", b."winning_side", bp."team",
             COUNT(*) AS "members",
             COUNT(*) FILTER (WHERE u."stable_type" = 'human') AS "humans",
             COUNT(*) FILTER (WHERE u."stable_type" = 'automaton' AND ap."strategy_key" IS NOT NULL) AS "automatons",
             COUNT(DISTINCT ap."strategy_key") AS "strategies",
             MIN(ap."strategy_key") AS "strategy_key",
             BOOL_OR(bp."robot_id" = b."winner_id") AS "holds_winner"
      FROM "battles" b
      JOIN "battle_participants" bp ON bp."battle_id" = b."id"
      JOIN "robots" r ON r."id" = bp."robot_id"
      JOIN "users" u ON u."id" = r."user_id"
      LEFT JOIN "automaton_profiles" ap ON ap."user_id" = u."id" AND ap."status" = 'active'
      WHERE b."battle_type" IN (${modes}) AND bp."robot_id" > 0
      GROUP BY b."id", bp."team"
    ),
    "counted" AS (
      SELECT s.*, COUNT(*) OVER (PARTITION BY s."battle_id") AS "side_count" FROM "sides" s
    ),
    "outcomes" AS (
      SELECT a."strategy_key",
             CASE
               WHEN a."battle_type" IN (${oneVsOne}) THEN
                 CASE WHEN a."winner_id" IS NULL THEN 'draw' WHEN a."holds_winner" THEN 'win' ELSE 'loss' END
               ELSE
                 CASE WHEN a."winning_side" IS NULL THEN 'draw' WHEN a."winning_side" = a."team" THEN 'win' ELSE 'loss' END
             END AS "outcome"
      FROM "counted" a
      JOIN "counted" h ON h."battle_id" = a."battle_id" AND h."team" <> a."team"
      WHERE a."side_count" = 2
        AND a."automatons" = a."members" AND a."strategies" = 1
        AND h."humans" = h."members"
    )
    SELECT "strategy_key",
           COUNT(*) FILTER (WHERE "outcome" = 'win')::int AS "wins",
           COUNT(*) FILTER (WHERE "outcome" = 'loss')::int AS "losses",
           COUNT(*) FILTER (WHERE "outcome" = 'draw')::int AS "draws"
    FROM "outcomes"
    GROUP BY "strategy_key"`;
  return new Map(rows.map((row) => {
    const total = row.wins + row.losses + row.draws;
    return [row.strategy_key, { wins: row.wins, losses: row.losses, draws: row.draws, total, percentage: winPercentage(row.wins, total) }];
  }));
}

interface HumanAggregateRow {
  stables: number;
  robots: number | null;
  prestige: number | null;
  credits: number | null;
}

interface HumanTierRow {
  owner_id: number;
  tier_rank: number;
}

const TIER_RANK_SQL = Prisma.sql`CASE s."tier"
  WHEN 'bronze' THEN 0 WHEN 'silver' THEN 1 WHEN 'gold' THEN 2
  WHEN 'platinum' THEN 3 WHEN 'diamond' THEN 4 WHEN 'champion' THEN 5 ELSE -1 END`;

/** The reference row: Human_Stables with at least one robot; null when there are none. */
async function readHumanReference(db: ComparisonDb): Promise<ComparisonRow | null> {
  const [aggregate] = await db.$queryRaw<HumanAggregateRow[]>`
    SELECT COUNT(*)::int AS "stables",
           AVG(h."robot_count")::float AS "robots",
           AVG(h."prestige")::float AS "prestige",
           AVG(h."currency")::float AS "credits"
    FROM (
      SELECT u."id", u."prestige", u."currency", COUNT(r."id") AS "robot_count"
      FROM "users" u
      JOIN "robots" r ON r."user_id" = u."id"
      WHERE u."stable_type" = 'human'
      GROUP BY u."id"
    ) h`;
  if (!aggregate || aggregate.stables === 0) return null;
  const tiers = await db.$queryRaw<HumanTierRow[]>`
    SELECT o."owner_id", MAX(o."tier_rank")::int AS "tier_rank"
    FROM (
      SELECT r."user_id" AS "owner_id", ${TIER_RANK_SQL} AS "tier_rank"
      FROM "standings" s JOIN "robots" r ON s."entity_type" = 'robot' AND r."id" = s."entity_id"
      UNION ALL
      SELECT t."stable_id" AS "owner_id", ${TIER_RANK_SQL} AS "tier_rank"
      FROM "standings" s JOIN "team_battles" t ON s."entity_type" = 'team' AND t."id" = s."entity_id"
    ) o
    JOIN "users" u ON u."id" = o."owner_id"
    WHERE u."stable_type" = 'human' AND o."tier_rank" >= 0
    GROUP BY o."owner_id"`;
  const round = (value: number | null, decimals: number): number => {
    const factor = 10 ** decimals;
    return Math.round((value ?? 0) * factor) / factor;
  };
  return {
    strategyKey: null,
    displayName: HUMAN_REFERENCE_LABEL,
    reference: true,
    stables: aggregate.stables,
    robots: { average: round(aggregate.robots, 1), targetAverage: null },
    prestigeAverage: round(aggregate.prestige, 0),
    bestTier: bestTierOf(tiers.map((t) => LEAGUE_TIER_ORDER[t.tier_rank] ?? null)),
    creditsAverage: round(aggregate.credits, 0),
    winRate: null,
  };
}

/** One row per strategy with at least one Active_Automaton, ordered by strategy key. */
async function readStrategyRows(registry: StrategyRegistry, db: ComparisonDb): Promise<ComparisonRow[]> {
  const profiles = await db.automatonProfile.findMany({
    where: { status: 'active', userId: { not: null } },
    select: {
      strategyKey: true,
      strategyVersion: true,
      strategyParameters: true,
      userId: true,
      user: { select: { currency: true, prestige: true, _count: { select: { robots: true } } } },
    },
    orderBy: { catalogueKey: 'asc' },
  });
  if (profiles.length === 0) return [];
  const [tiers, winRates] = await Promise.all([
    bestTiersForUsers(profiles.flatMap((p) => (p.userId === null ? [] : [p.userId])), db),
    readWinRates(db),
  ]);
  const byStrategy = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const group = byStrategy.get(profile.strategyKey) ?? [];
    group.push(profile);
    byStrategy.set(profile.strategyKey, group);
  }
  return [...byStrategy.keys()].sort().map((strategyKey): ComparisonRow => {
    const group = byStrategy.get(strategyKey) ?? [];
    const latest = registry.latestVersion(strategyKey);
    const displayName = (latest === undefined ? undefined : registry.getStrategy(strategyKey, latest)?.displayName) ?? strategyKey;
    const targets = group.flatMap((p) => {
      const strategy = registry.getStrategy(p.strategyKey, p.strategyVersion);
      if (!strategy) return [];
      const target = highestRobotsTarget(strategy.buildOrder, storedParameters(strategy, p.strategyParameters) ?? { targets: {} });
      return target === null ? [] : [target];
    });
    return {
      strategyKey,
      displayName,
      reference: false,
      stables: group.length,
      robots: { average: average(group.map((p) => p.user?._count.robots ?? 0)), targetAverage: targets.length > 0 ? average(targets) : null },
      prestigeAverage: average(group.map((p) => p.user?.prestige ?? 0), 0),
      bestTier: bestTierOf(group.map((p) => (p.userId === null ? null : tiers.get(p.userId) ?? null))),
      creditsAverage: average(group.map((p) => p.user?.currency ?? 0), 0),
      winRate: winRates.get(strategyKey) ?? { wins: 0, losses: 0, draws: 0, total: 0, percentage: null },
    };
  });
}

// ── Cache and entry point ────────────────────────────────────────────

let cache: { value: StrategyComparison; expiresAt: number } | null = null;

/** Drop the cached comparison (tests; the cache otherwise expires after 60 s). */
export function clearStrategyComparisonCache(): void {
  cache = null;
}

/** The Strategy_Comparison of the current season (R11.13), cached for 60 seconds. */
export async function getStrategyComparison(deps: StrategyComparisonDeps = {}, now: () => number = Date.now): Promise<StrategyComparison> {
  if (cache && cache.expiresAt > now()) return cache.value;
  const registry = deps.registry ?? getStrategyRegistry();
  const db = deps.db ?? prisma;
  const [season, rows, reference] = await Promise.all([getCurrentSeason(), readStrategyRows(registry, db), readHumanReference(db)]);
  const value: StrategyComparison = {
    season: {
      seasonNumber: season.seasonNumber,
      phase: season.phase,
      cycle: season.seasonCycle,
      lengthCycles: season.seasonLengthCycles,
      preparationDay: season.preparationDay,
    },
    rows: reference ? [...rows, reference] : rows,
    generatedAt: new Date(now()).toISOString(),
  };
  cache = { value, expiresAt: now() + COMPARISON_CACHE_TTL_MS };
  return value;
}
