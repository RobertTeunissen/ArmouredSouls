/**
 * Strategies → Economy (`/admin/automatons?tab=strategies&view=economy`):
 * per Upgrade_Strategy, how many Active_Automatons are in deficit, their
 * median balance, what a stable earns and pays in running costs per cycle,
 * and the Goal most of them are stuck saving for.
 *
 * Flows read `financial_ledger` over the last closed cycles (the ledger is
 * season-scoped). "Per cycle" divides by the cycles each stable actually has
 * ledger rows in, so stables activated inside the window are not averaged
 * down. Activation batches (one per activation day) let a later batch be
 * compared with the first. Cached for 60 seconds per batch filter.
 *
 * @module services/automaton/strategyEconomyService
 */

import prisma from '../../lib/prisma';
import { getStrategyRegistry } from './strategies/defaultRegistry';
import type { StrategyRegistry } from './strategies/registry';
import { describeBuildOrder, resolveGoalTarget } from './strategies/strategyParameters';
import { storedParameters } from './automatonProfileRules';
import { savingGoalOf } from './turnRecords';
import { AutomatonError, AutomatonErrorCode } from '../../errors/automatonErrors';
import { readStableCashflow, type StableCashflow } from '../admin/stableCashflow';

/** Closed cycles the per-cycle flows cover. */
export const STRATEGY_ECONOMY_WINDOW_CYCLES = 7;
const CACHE_TTL_MS = 60_000;

export interface StrategyEconomyRow {
  strategyKey: string;
  displayName: string;
  stables: number;
  /** Balance below ₡0 now. */
  inDeficit: number;
  medianBalance: number;
  /** Per stable per cycle with ledger rows in the window; null without any. */
  earnedPerCycle: number | null;
  runningCostsPerCycle: number | null;
  /** The Goal most stables' latest completed turn ended Saving on. */
  topSavingGoal: { label: string; target: number | null; stables: number } | null;
}

export interface StrategyEconomy {
  window: { fromCycle: number; toCycle: number };
  /** Activation days (UTC) with their stable counts, oldest first. */
  batches: { date: string; stables: number }[];
  /** The batch filter applied: an activation day, or null for all. */
  activated: string | null;
  rows: StrategyEconomyRow[];
  totals: { stables: number; inDeficit: number };
  generatedAt: string;
}

interface FlowRow {
  user_id: number;
  earned: bigint | number | null;
  running: bigint | number | null;
  cycles: bigint | number;
}

interface LatestTurnRow {
  profile_id: number;
  goal_outcomes: unknown;
}

const num = (value: bigint | number | null): number => (value === null ? 0 : Number(value));

/** Lower-middle median; 0 when empty (as on the Economy page). */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

const cache = new Map<string, { at: number; value: StrategyEconomy }>();

/** Drop the cache (tests). */
export function clearStrategyEconomyCache(): void {
  cache.clear();
}

/** The Economy view, optionally for one activation day (`YYYY-MM-DD`). */
export async function getStrategyEconomy(
  activated: string | null,
  deps: { registry?: StrategyRegistry; now?: () => number } = {},
): Promise<StrategyEconomy> {
  const now = deps.now ?? Date.now;
  const key = activated ?? 'all';
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_TTL_MS) return hit.value;
  const registry = deps.registry ?? getStrategyRegistry();

  const [meta, allProfiles] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } }),
    prisma.automatonProfile.findMany({
      where: { status: 'active', userId: { not: null } },
      select: {
        id: true, userId: true, strategyKey: true, strategyVersion: true, strategyParameters: true, activatedAt: true,
        user: { select: { currency: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ]);
  const toCycle = meta?.totalCycles ?? 0;
  const fromCycle = Math.max(1, toCycle - STRATEGY_ECONOMY_WINDOW_CYCLES + 1);

  const batchCounts = new Map<string, number>();
  for (const p of allProfiles) {
    if (!p.activatedAt) continue;
    const day = dayOf(p.activatedAt);
    batchCounts.set(day, (batchCounts.get(day) ?? 0) + 1);
  }
  const profiles = activated ? allProfiles.filter((p) => p.activatedAt && dayOf(p.activatedAt) === activated) : allProfiles;
  const userIds = profiles.flatMap((p) => (p.userId === null ? [] : [p.userId]));
  const profileIds = profiles.map((p) => p.id);

  const [flows, latestTurns] = await Promise.all([
    userIds.length === 0 || toCycle === 0 ? Promise.resolve([] as FlowRow[]) : prisma.$queryRaw<FlowRow[]>`
      SELECT user_id,
        SUM(amount) FILTER (WHERE amount > 0) AS earned,
        -SUM(amount) FILTER (WHERE amount < 0 AND transaction_type IN ('repair_cost', 'operating_costs')) AS running,
        COUNT(DISTINCT cycle_number) AS cycles
      FROM financial_ledger
      WHERE user_id = ANY(${userIds}::int[]) AND cycle_number BETWEEN ${fromCycle} AND ${toCycle}
      GROUP BY user_id`,
    profileIds.length === 0 ? Promise.resolve([] as LatestTurnRow[]) : prisma.$queryRaw<LatestTurnRow[]>`
      SELECT DISTINCT ON (profile_id) profile_id, goal_outcomes
      FROM automaton_turns
      WHERE profile_id = ANY(${profileIds}::int[]) AND status = 'completed'
      ORDER BY profile_id, started_at DESC, id DESC`,
  ]);
  const flowBy = new Map(flows.map((row) => [row.user_id, row]));
  const goalBy = new Map(latestTurns.map((row) => [row.profile_id, savingGoalOf(row.goal_outcomes as never)]));

  const byStrategy = new Map<string, typeof profiles>();
  for (const p of profiles) byStrategy.set(p.strategyKey, [...(byStrategy.get(p.strategyKey) ?? []), p]);

  const rows = [...byStrategy.entries()].map(([strategyKey, group]): StrategyEconomyRow => {
    const latest = registry.latestVersion(strategyKey);
    const displayName = (latest === undefined ? undefined : registry.getStrategy(strategyKey, latest)?.displayName) ?? strategyKey;
    const balances = group.map((p) => p.user?.currency ?? 0);
    let earned = 0;
    let running = 0;
    let cycles = 0;
    const goals = new Map<string, { label: string; target: number | null; stables: number }>();
    for (const p of group) {
      const flow = p.userId === null ? undefined : flowBy.get(p.userId);
      if (flow) {
        earned += num(flow.earned);
        running += num(flow.running);
        cycles += num(flow.cycles);
      }
      const goalId = goalBy.get(p.id);
      if (!goalId) continue;
      const strategy = registry.getStrategy(p.strategyKey, p.strategyVersion);
      const definition = strategy?.buildOrder.find((d) => d.id === goalId);
      const label = (definition ? describeBuildOrder([definition])[0]?.label : undefined) ?? goalId;
      const target = definition && strategy ? resolveGoalTarget(definition, storedParameters(strategy, p.strategyParameters) ?? { targets: {} }) : null;
      const goalKey = `${label}|${target ?? ''}`;
      const entry = goals.get(goalKey) ?? { label, target, stables: 0 };
      entry.stables += 1;
      goals.set(goalKey, entry);
    }
    const topSavingGoal = [...goals.values()].sort((a, b) => b.stables - a.stables || a.label.localeCompare(b.label))[0] ?? null;
    return {
      strategyKey,
      displayName,
      stables: group.length,
      inDeficit: balances.filter((b) => b < 0).length,
      medianBalance: median(balances),
      earnedPerCycle: cycles > 0 ? Math.round(earned / cycles) : null,
      runningCostsPerCycle: cycles > 0 ? Math.round(running / cycles) : null,
      topSavingGoal,
    };
  }).sort((a, b) => b.stables - a.stables || a.strategyKey.localeCompare(b.strategyKey));

  const value: StrategyEconomy = {
    window: { fromCycle, toCycle },
    batches: [...batchCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, stables]) => ({ date, stables })),
    activated,
    rows,
    totals: { stables: rows.reduce((s, r) => s + r.stables, 0), inDeficit: rows.reduce((s, r) => s + r.inDeficit, 0) },
    generatedAt: new Date(now()).toISOString(),
  };
  cache.set(key, { at: now(), value });
  return value;
}

/** The Editor's Cashflow card: one Automaton's last ledger cycles (empty for a draft). */
export async function getProfileCashflow(catalogueKey: string): Promise<StableCashflow> {
  const profile = await prisma.automatonProfile.findUnique({ where: { catalogueKey }, select: { userId: true } });
  if (!profile) throw new AutomatonError(AutomatonErrorCode.AUTOMATON_NOT_FOUND, `No Automaton stable ${catalogueKey}`, 404);
  if (profile.userId === null) return { points: [], earned: 0, runningCosts: 0, bought: 0, lowBalanceCycles: 0 };
  return readStableCashflow(profile.userId);
}
