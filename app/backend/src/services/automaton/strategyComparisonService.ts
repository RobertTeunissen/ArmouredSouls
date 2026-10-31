/**
 * Strategy_Comparison (Spec #55, R11.13, R11.14, design §17.3, task 9.7).
 *
 * Current season only: `battles`, `battle_participants` and `standings` hold
 * only the current season (purged at rollover), so no season filter is
 * needed on them. One row per Upgrade_Strategy with at least one
 * Active_Automaton, plus a Human_Stable reference row when at least one
 * Human_Stable owns a robot.
 *
 * The win rate against human stables was dropped (admin redesign part 5):
 * with few human stables its sample was tiny, and the per-mode block answers
 * "which strategy works" from every opponent.
 *
 * Reads `standings` for the highest current tier and the
 * per-mode block (`modes`, see `strategyModePerformance.ts`). Both standings
 * reads count played rows only (default Bronze rows are ignored). Cached for
 * 60 seconds.
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import { getCurrentSeason } from '../season/seasonService';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import { highestRobotsTarget } from './strategies/strategyParameters';
import type { StrategyRegistry } from './strategies/registry';
import { storedParameters } from './automatonProfileRules';
import { bestTiersForUsers, LEAGUE_TIER_ORDER, PLAYED_STANDING_SQL, TIERED_MODE_SQL, type LeagueTier } from './standingsTier';
import type { HighestTier } from '../../shared/utils/automatonStandingsTier';
import { buildModePerformance, readModeAggregates, winPercentage, type ModePerformance } from './strategyModePerformance';

export { winPercentage };

export const COMPARISON_CACHE_TTL_MS = 60_000;

export const HUMAN_REFERENCE_LABEL = 'Human stables (reference)';

export interface ComparisonRow {
  /** The strategy key; null on the reference row. */
  strategyKey: string | null;
  displayName: string;
  reference: boolean;
  stables: number;
  robots: { average: number; targetAverage: number | null };
  prestigeAverage: number;
  /** The highest current tier any robot or team holds (played rows only), with the number of stables whose own highest equals it. */
  bestTier: { tier: LeagueTier; stables: number } | null;
  creditsAverage: number;
  /** Six entries in `TIERED_STANDINGS_MODES` order, zero-filled. */
  modes: ModePerformance[];
}

/** A row before its per-mode block is attached. */
type ComparisonRowBase = Omit<ComparisonRow, 'modes'>;

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

/** The best tier over stables' own highest tiers and how many stables hold it. */
export function bestTierOf(tiers: readonly (Pick<HighestTier, 'tier'> | null)[]): { tier: LeagueTier; stables: number } | null {
  let best = -1;
  let count = 0;
  for (const highest of tiers) {
    if (highest === null) continue;
    const rank = LEAGUE_TIER_ORDER.indexOf(highest.tier);
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

/** Tier rank in SQL, generated from `LEAGUE_TIER_ORDER` so the reference row ranks tiers as the strategy rows do. */
const TIER_RANK_SQL = Prisma.sql`CASE s."tier" ${Prisma.join(
  LEAGUE_TIER_ORDER.map((tier, rank) => Prisma.sql`WHEN ${tier} THEN ${rank}`),
  ' ',
)} ELSE -1 END`;

/** The reference row: Human_Stables with at least one robot; null when there are none. */
async function readHumanReference(db: ComparisonDb): Promise<ComparisonRowBase | null> {
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
      WHERE ${TIERED_MODE_SQL} AND ${PLAYED_STANDING_SQL}
      UNION ALL
      SELECT t."stable_id" AS "owner_id", ${TIER_RANK_SQL} AS "tier_rank"
      FROM "standings" s JOIN "team_battles" t ON s."entity_type" = 'team' AND t."id" = s."entity_id"
      WHERE ${TIERED_MODE_SQL} AND ${PLAYED_STANDING_SQL}
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
    bestTier: bestTierOf(tiers.map((t) => {
      const tier: LeagueTier | undefined = LEAGUE_TIER_ORDER[t.tier_rank];
      return tier === undefined ? null : { tier };
    })),
    creditsAverage: round(aggregate.credits, 0),
  };
}

/** One row per strategy with at least one Active_Automaton, ordered by strategy key. */
async function readStrategyRows(registry: StrategyRegistry, db: ComparisonDb): Promise<ComparisonRowBase[]> {
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
  const tiers = await bestTiersForUsers(profiles.flatMap((p) => (p.userId === null ? [] : [p.userId])), db);
  const byStrategy = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const group = byStrategy.get(profile.strategyKey) ?? [];
    group.push(profile);
    byStrategy.set(profile.strategyKey, group);
  }
  return [...byStrategy.keys()].sort().map((strategyKey): ComparisonRowBase => {
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
  const [season, strategyRows, reference, modeAggregates] = await Promise.all([
    getCurrentSeason(),
    readStrategyRows(registry, db),
    readHumanReference(db),
    readModeAggregates(db),
  ]);
  const withModes = (row: ComparisonRowBase): ComparisonRow => ({ ...row, modes: buildModePerformance(modeAggregates, row.strategyKey) });
  const rows = (reference ? [...strategyRows, reference] : strategyRows).map(withModes);
  const value: StrategyComparison = {
    season: {
      seasonNumber: season.seasonNumber,
      phase: season.phase,
      cycle: season.seasonCycle,
      lengthCycles: season.seasonLengthCycles,
      preparationDay: season.preparationDay,
    },
    rows,
    generatedAt: new Date(now()).toISOString(),
  };
  cache = { value, expiresAt: now() + COMPARISON_CACHE_TTL_MS };
  return value;
}
