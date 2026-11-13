/**
 * Economy admin page (`/admin/economy`): where credits come from, where they
 * go, and where they pile up, per stable type.
 *
 * Flows come from `financial_ledger` (every current-economy credit mutation;
 * the ledger is season-scoped, purged at rollover), balances from
 * `users.currency`. One season-wide dataset is read per minute and every
 * stable-type / window view is sliced from it in memory. The ledger is summed
 * per closed cycle and stored (`economyCycleRollups.ts`): rescanning the whole
 * season took longer than the statement timeout on ACC. Until the cycles a
 * window needs are stored the page answers `status: 'preparing'` with progress.
 *
 * Windows count closed cycles: the ledger's cycle in progress is
 * `cycle_metadata.total_cycles + 1` and is left out.
 *
 * The Repairs block (it replaced the Repair Log page) reads the `repair_cost`
 * rows' breakdown: `baseQuote` is the full price, `quoteBeforeManualDiscount`
 * the price after the Repair Bay discount, and the amount what was paid.
 *
 * @module services/admin/adminEconomyService
 */

import prisma from '../../lib/prisma';
import { buildUserFilter } from '../../utils/buildUserFilter';
import { getCurrentSeason } from '../season/seasonService';
import { loadCycleTotals } from './economyCycleRollups';
import type {
  EconomyFlow,
  EconomyOverview,
  EconomyRepairs,
  EconomyResponse,
  EconomyStableScope,
  EconomyWindow,
  RepairTotals,
  EconomyStableKind,
} from '../../shared/types';

export const ECONOMY_STABLE_SCOPES = ['players', 'automatons', 'generated', 'all'] as const satisfies readonly EconomyStableScope[];
export const ECONOMY_WINDOWS = ['7', '14', '30', 'season'] as const satisfies readonly EconomyWindow[];
const STABLE_KINDS: readonly EconomyStableKind[] = ['players', 'automatons', 'generated'];

/** The per-cycle chart shows at least this many cycles, whatever the window. */
const ECONOMY_CHART_MIN_CYCLES = 15;
const CACHE_TTL_MS = 60_000;

/** Ledger transaction types that bring credits in, with their labels, in display order. */
const SOURCE_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['battle_income', 'Battle income'],
  ['streaming_revenue', 'Streaming'],
  ['passive_income', 'Merchandising'],
  ['achievement_reward', 'Achievements'],
  ['weapon_sale', 'Weapon sales'],
];

/** Sinks; several types can share a label (weapons and robots are one line). */
const SINK_LABELS: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ['attribute_upgrade', 'Attribute upgrades', ['attribute_upgrade']],
  ['facility_upgrade', 'Facility upgrades', ['facility_upgrade']],
  ['repair_cost', 'Repairs', ['repair_cost']],
  ['weapon_refinement', 'Weapon refinement', ['weapon_refinement']],
  ['operating_costs', 'Operating costs', ['operating_costs']],
  ['weapons_and_robots', 'Weapons + robots', ['weapon_purchase', 'robot_creation']],
];

/** Balance bands, lower bound inclusive. */
const BANDS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: 'below ₡0', min: Number.NEGATIVE_INFINITY, max: 0 },
  { label: '₡0–100k', min: 0, max: 100_000 },
  { label: '₡100k–1M', min: 100_000, max: 1_000_000 },
  { label: '₡1–3M', min: 1_000_000, max: 3_000_000 },
  { label: '₡3–5M', min: 3_000_000, max: 5_000_000 },
  { label: '₡5–10M', min: 5_000_000, max: 10_000_000 },
  { label: '₡10M+', min: 10_000_000, max: Number.POSITIVE_INFINITY },
];

interface LedgerGroup {
  kind: EconomyStableKind | 'other';
  transactionType: string;
  cycle: number;
  income: number;
  spend: number;
}

export type RepairKind = 'automatic' | 'manual';

export interface RepairGroup {
  kind: EconomyStableKind | 'other';
  cycle: number;
  repairType: RepairKind;
  repairs: number;
  fullPrice: number;
  afterRepairBay: number;
  paid: number;
}

/** One player stable that repaired in a cycle, by repair type. */
export interface PlayerRepairRow {
  userId: number;
  cycle: number;
  repairType: RepairKind;
}

interface Dataset {
  totalCycles: number;
  /** Every cycle from here to `totalCycles` is summed; earlier ones may still be missing. */
  completeFrom: number;
  /** Cycles present (summed), for progress. */
  present: Set<number>;
  balances: Record<EconomyStableKind | 'all', number[]>;
  groups: LedgerGroup[];
  repairGroups: RepairGroup[];
  playerRepairs: PlayerRepairRow[];
}

let cache: { at: number; data: Dataset } | null = null;

/** Drop the cached dataset (tests). */
export function invalidateEconomyCache(): void {
  cache = null;
}

async function loadDataset(): Promise<Dataset> {
  const [meta, users, players, season] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } }),
    prisma.user.findMany({ select: { id: true, currency: true, stableType: true, isGenerated: true } }),
    prisma.user.findMany({ where: buildUserFilter('real'), select: { id: true } }),
    getCurrentSeason(),
  ]);
  const totalCycles = meta?.totalCycles ?? 0;
  const playerIds = new Set(players.map((u) => u.id));
  const kindOf = (u: { id: number; stableType: string; isGenerated: boolean }): EconomyStableKind | 'other' => {
    if (u.stableType === 'automaton') return 'automatons';
    if (u.isGenerated) return 'generated';
    return playerIds.has(u.id) ? 'players' : 'other';
  };

  const balances: Dataset['balances'] = { players: [], automatons: [], generated: [], all: [] };
  for (const user of users) {
    const kind = kindOf(user);
    balances.all.push(user.currency);
    if (kind !== 'other') balances[kind].push(user.currency);
  }

  const { cycles, completeFrom } = await loadCycleTotals(season.seasonNumber, totalCycles, [...playerIds]);
  const groups: LedgerGroup[] = [];
  const repairGroups: RepairGroup[] = [];
  const playerRepairs: PlayerRepairRow[] = [];
  for (const { cycle, flows, repairs } of cycles) {
    for (const flow of flows) groups.push({ kind: flow.kind, transactionType: flow.transactionType, cycle, income: flow.income, spend: flow.spend });
    for (const repair of repairs) {
      repairGroups.push({
        kind: repair.kind,
        cycle,
        repairType: repair.repairType,
        repairs: repair.repairs,
        fullPrice: repair.fullPrice,
        afterRepairBay: repair.afterRepairBay,
        paid: repair.paid,
      });
      for (const userId of repair.stableIds) playerRepairs.push({ userId, cycle, repairType: repair.repairType });
    }
  }
  return { totalCycles, completeFrom, present: new Set(cycles.map((c) => c.cycle)), balances, groups, repairGroups, playerRepairs };
}

async function dataset(fresh: boolean): Promise<Dataset> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = await loadDataset();
  // An incomplete dataset (cycles still being summed) is not cached, so the next request picks up progress.
  cache = data.completeFrom <= 1 ? { at: Date.now(), data } : null;
  return data;
}

/** Median of a list (lower middle for an even count, as before on this page); 0 when empty. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Count of balances per band. */
export function balanceBands(values: readonly number[]): EconomyOverview['balanceBands'] {
  return BANDS.map((band) => ({
    label: band.label,
    negative: band.max <= 0,
    count: values.filter((v) => v >= band.min && v < band.max).length,
  }));
}

const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);
const percentOneDecimal = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

const emptyRepairTotals = (): RepairTotals => ({ repairs: 0, fullPrice: 0, repairBayDiscount: 0, manualDiscount: 0, paid: 0 });

function addRepairs(totals: RepairTotals, group: RepairGroup): void {
  totals.repairs += group.repairs;
  totals.fullPrice += group.fullPrice;
  totals.paid += group.paid;
  if (group.repairType === 'manual') {
    totals.repairBayDiscount += group.fullPrice - group.afterRepairBay;
    totals.manualDiscount += group.afterRepairBay - group.paid;
  } else {
    // Automatic repairs have no manual step: whatever the full price exceeds the charge by is the Repair Bay.
    totals.repairBayDiscount += group.fullPrice - group.paid;
  }
}

/**
 * The Repairs block for one scope and window (pure, exported for tests):
 * totals per repair type, how many player stables repaired and used Manual
 * Repair, and every stable type side by side.
 */
export function summarizeRepairs(
  groups: readonly RepairGroup[],
  playerRepairs: readonly PlayerRepairRow[],
  stables: EconomyStableScope,
  fromCycle: number,
  toCycle: number,
): EconomyRepairs {
  const inWindow = (cycle: number): boolean => cycle >= fromCycle && cycle <= toCycle;
  const windowed = groups.filter((g) => inWindow(g.cycle));
  const automatic = emptyRepairTotals();
  const manual = emptyRepairTotals();
  const total = emptyRepairTotals();
  for (const group of windowed) {
    if (stables !== 'all' && group.kind !== stables) continue;
    addRepairs(group.repairType === 'manual' ? manual : automatic, group);
    addRepairs(total, group);
  }

  const players = playerRepairs.filter((row) => inWindow(row.cycle));
  const playerStables = stables === 'players' || stables === 'all'
    ? {
      repairing: new Set(players.map((row) => row.userId)).size,
      manual: new Set(players.filter((row) => row.repairType === 'manual').map((row) => row.userId)).size,
    }
    : null;

  const byStableType = STABLE_KINDS.map((kind) => {
    const kindTotals = emptyRepairTotals();
    let manualRepairs = 0;
    for (const group of windowed) {
      if (group.kind !== kind) continue;
      addRepairs(kindTotals, group);
      if (group.repairType === 'manual') manualRepairs += group.repairs;
    }
    return {
      stables: kind,
      repairs: kindTotals.repairs,
      paid: kindTotals.paid,
      repairBayShare: percentOneDecimal(kindTotals.repairBayDiscount, kindTotals.fullPrice),
      manualShare: percentOneDecimal(manualRepairs, kindTotals.repairs),
    };
  });

  return { automatic, manual, total, playerStables, byStableType };
}

/** First closed cycle of a window that ends at `totalCycles`. */
export function windowStart(window: EconomyWindow, totalCycles: number): number {
  if (window === 'season') return Math.min(1, totalCycles);
  return Math.max(1, totalCycles - Number(window) + 1);
}

/** The Economy page for one stable scope and window. */
export async function getEconomyOverview(
  stables: EconomyStableScope,
  window: EconomyWindow,
  options: { fresh?: boolean } = {},
): Promise<EconomyResponse> {
  const data = await dataset(options.fresh === true);
  const { totalCycles } = data;
  const fromCycle = windowStart(window, totalCycles);
  const cycles = totalCycles >= fromCycle && totalCycles > 0 ? totalCycles - fromCycle + 1 : 0;
  const chartFrom = Math.max(1, Math.min(fromCycle, totalCycles - ECONOMY_CHART_MIN_CYCLES + 1));
  const scope = { stables, window, fromCycle, toCycle: totalCycles, cycles };

  const neededFrom = Math.min(fromCycle, chartFrom);
  if (totalCycles > 0 && data.completeFrom > neededFrom) {
    let cyclesReady = 0;
    for (let cycle = neededFrom; cycle <= totalCycles; cycle += 1) if (data.present.has(cycle)) cyclesReady += 1;
    return { status: 'preparing', scope, cyclesReady, cyclesNeeded: totalCycles - neededFrom + 1, timestamp: new Date().toISOString() };
  }

  const inScope = (g: LedgerGroup): boolean => stables === 'all' || g.kind === stables;
  const inWindow = (g: LedgerGroup): boolean => g.cycle >= fromCycle && g.cycle <= totalCycles;
  const scoped = data.groups.filter((g) => inScope(g) && inWindow(g));

  const incomeOf = (types: readonly string[]): number => sum(scoped.filter((g) => types.includes(g.transactionType)).map((g) => g.income));
  const spendOf = (types: readonly string[]): number => sum(scoped.filter((g) => types.includes(g.transactionType)).map((g) => g.spend));

  const earned = sum(scoped.map((g) => g.income));
  const spent = sum(scoped.map((g) => g.spend));
  const sources: EconomyFlow[] = SOURCE_LABELS.map(([key, label]) => ({ key, label, amount: incomeOf([key]) }));
  const otherIncome = earned - sum(sources.map((s) => s.amount));
  if (otherIncome > 0) sources.push({ key: 'other', label: 'Other', amount: otherIncome });
  const sinks: EconomyFlow[] = SINK_LABELS.map(([key, label, types]) => ({ key, label, amount: spendOf(types) }));
  const otherSpend = spent - sum(sinks.map((s) => s.amount));
  if (otherSpend > 0) sinks.push({ key: 'other', label: 'Other', amount: otherSpend });

  const perCycle: EconomyOverview['perCycle'] = [];
  for (let cycle = chartFrom; cycle <= totalCycles; cycle += 1) {
    const rows = data.groups.filter((g) => inScope(g) && g.cycle === cycle);
    perCycle.push({ cycle, earned: sum(rows.map((g) => g.income)), spent: sum(rows.map((g) => g.spend)) });
  }

  const balances = data.balances[stables];
  const repairs = spendOf(['repair_cost']);
  const battleIncome = incomeOf(['battle_income']);

  return {
    status: 'ready',
    scope,
    kpis: {
      earned,
      spent,
      net: earned - spent,
      earnedPerCycle: cycles > 0 ? Math.round(earned / cycles) : 0,
      spentPerCycle: cycles > 0 ? Math.round(spent / cycles) : 0,
      repairsShareOfBattleIncome: percentOneDecimal(repairs, battleIncome),
      heldNow: sum(balances),
      medianBalance: median(balances),
      stables: balances.length,
    },
    sources,
    sinks,
    perCycle,
    balanceBands: balanceBands(balances),
    byStableType: STABLE_KINDS.map((kind) => {
      const rows = data.groups.filter((g) => g.kind === kind && inWindow(g));
      const kindEarned = sum(rows.map((g) => g.income));
      const kindSpent = sum(rows.map((g) => g.spend));
      return { stables: kind, count: data.balances[kind].length, earned: kindEarned, spent: kindSpent, net: kindEarned - kindSpent, heldNow: sum(data.balances[kind]) };
    }),
    repairs: summarizeRepairs(data.repairGroups, data.playerRepairs, stables, fromCycle, totalCycles),
    timestamp: new Date().toISOString(),
  };
}
