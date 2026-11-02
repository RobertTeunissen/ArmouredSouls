/**
 * Economy admin page (`/admin/economy`): where credits come from, where they
 * go, and where they pile up, per stable type.
 *
 * Flows come from `financial_ledger` (every current-economy credit mutation;
 * the ledger is season-scoped, purged at rollover), balances from
 * `users.currency`. One season-wide dataset is read per minute and every
 * stable-type / window view is sliced from it in memory.
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

export const ECONOMY_STABLE_SCOPES = ['players', 'automatons', 'generated', 'all'] as const;
export type EconomyStableScope = (typeof ECONOMY_STABLE_SCOPES)[number];
export const ECONOMY_WINDOWS = ['7', '14', '30', 'season'] as const;
export type EconomyWindow = (typeof ECONOMY_WINDOWS)[number];

type StableKind = Exclude<EconomyStableScope, 'all'>;
const STABLE_KINDS: readonly StableKind[] = ['players', 'automatons', 'generated'];

/** The per-cycle chart shows at least this many cycles, whatever the window. */
export const ECONOMY_CHART_MIN_CYCLES = 15;
const CACHE_TTL_MS = 60_000;

export interface EconomyFlow {
  key: string;
  label: string;
  amount: number;
}

/** Repairs of one kind (or all) in the window. full − repairBayDiscount − manualDiscount = paid. */
export interface RepairTotals {
  repairs: number;
  /** The shared repair formula's quote before any discount. */
  fullPrice: number;
  repairBayDiscount: number;
  manualDiscount: number;
  paid: number;
}

export interface EconomyRepairs {
  automatic: RepairTotals;
  manual: RepairTotals;
  total: RepairTotals;
  /** Player stables in scope that repaired, and that used Manual Repair; null when the scope has no players. */
  playerStables: { repairing: number; manual: number } | null;
  /** Every stable type in the same window, whatever the scope. Shares are one-decimal percentages. */
  byStableType: { stables: StableKind; repairs: number; paid: number; repairBayShare: number | null; manualShare: number | null }[];
}

export interface EconomyOverview {
  scope: { stables: EconomyStableScope; window: EconomyWindow; fromCycle: number; toCycle: number; cycles: number };
  kpis: {
    earned: number;
    spent: number;
    net: number;
    earnedPerCycle: number;
    spentPerCycle: number;
    /** Repair costs ÷ battle income, one decimal percent; null without battle income. */
    repairsShareOfBattleIncome: number | null;
    heldNow: number;
    medianBalance: number;
    stables: number;
  };
  sources: EconomyFlow[];
  sinks: EconomyFlow[];
  perCycle: { cycle: number; earned: number; spent: number }[];
  balanceBands: { label: string; count: number; negative: boolean }[];
  byStableType: { stables: StableKind; count: number; earned: number; spent: number; net: number; heldNow: number }[];
  repairs: EconomyRepairs;
  timestamp: string;
}

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
  kind: StableKind | 'other';
  transactionType: string;
  cycle: number;
  income: number;
  spend: number;
}

export type RepairKind = 'automatic' | 'manual';

export interface RepairGroup {
  kind: StableKind | 'other';
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
  balances: Record<StableKind | 'all', number[]>;
  groups: LedgerGroup[];
  repairGroups: RepairGroup[];
  playerRepairs: PlayerRepairRow[];
}

let cache: { at: number; data: Dataset } | null = null;

/** Drop the cached dataset (tests). */
export function invalidateEconomyCache(): void {
  cache = null;
}

interface RepairGroupRow {
  kind: string;
  cycle_number: number;
  repair_type: string;
  repairs: number;
  full_price: unknown;
  after_bay: unknown;
  paid: unknown;
}

interface PlayerRepairDbRow {
  user_id: number;
  cycle_number: number;
  repair_type: string;
}

interface GroupRow {
  kind: string;
  transaction_type: string;
  cycle_number: number;
  income: bigint | number | null;
  spend: bigint | number | null;
}

async function loadDataset(): Promise<Dataset> {
  const [meta, users, players] = await Promise.all([
    prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } }),
    prisma.user.findMany({ select: { id: true, currency: true, stableType: true, isGenerated: true } }),
    prisma.user.findMany({ where: buildUserFilter('real'), select: { id: true } }),
  ]);
  const totalCycles = meta?.totalCycles ?? 0;
  const playerIds = new Set(players.map((u) => u.id));
  const kindOf = (u: { id: number; stableType: string; isGenerated: boolean }): StableKind | 'other' => {
    if (u.stableType === 'automaton') return 'automatons';
    if (u.isGenerated) return 'generated';
    return playerIds.has(u.id) ? 'players' : 'other';
  };

  const balances: Dataset['balances'] = { players: [], automatons: [], generated: [], all: [] };
  const ids: Record<StableKind, number[]> = { players: [], automatons: [], generated: [] };
  for (const user of users) {
    const kind = kindOf(user);
    balances.all.push(user.currency);
    if (kind !== 'other') {
      balances[kind].push(user.currency);
      ids[kind].push(user.id);
    }
  }

  const rows = totalCycles > 0
    ? await prisma.$queryRaw<GroupRow[]>`
      SELECT
        CASE
          WHEN user_id = ANY(${ids.players}::int[]) THEN 'players'
          WHEN user_id = ANY(${ids.automatons}::int[]) THEN 'automatons'
          WHEN user_id = ANY(${ids.generated}::int[]) THEN 'generated'
          ELSE 'other'
        END AS kind,
        transaction_type,
        cycle_number,
        SUM(amount) FILTER (WHERE amount > 0) AS income,
        -SUM(amount) FILTER (WHERE amount < 0) AS spend
      FROM financial_ledger
      WHERE cycle_number BETWEEN 1 AND ${totalCycles}
      GROUP BY 1, 2, 3`
    : [];
  const num = (value: unknown): number => (value === null || value === undefined ? 0 : Number(value));
  const repairTypeOf = (raw: string): RepairKind => (raw === 'manual' ? 'manual' : 'automatic');
  // Rows written before the repair breakdown existed have no quotes: their full price is what was paid.
  const [repairRows, playerRepairRows] = totalCycles > 0
    ? await Promise.all([
      prisma.$queryRaw<RepairGroupRow[]>`
        SELECT
          CASE
            WHEN user_id = ANY(${ids.players}::int[]) THEN 'players'
            WHEN user_id = ANY(${ids.automatons}::int[]) THEN 'automatons'
            WHEN user_id = ANY(${ids.generated}::int[]) THEN 'generated'
            ELSE 'other'
          END AS kind,
          cycle_number,
          COALESCE(metadata->>'repairType', 'automatic') AS repair_type,
          COUNT(*)::int AS repairs,
          SUM(COALESCE((metadata->>'baseQuote')::numeric, -amount)) AS full_price,
          SUM(COALESCE((metadata->>'quoteBeforeManualDiscount')::numeric, -amount)) AS after_bay,
          -SUM(amount) AS paid
        FROM financial_ledger
        WHERE transaction_type = 'repair_cost' AND cycle_number BETWEEN 1 AND ${totalCycles}
        GROUP BY 1, 2, 3`,
      prisma.$queryRaw<PlayerRepairDbRow[]>`
        SELECT user_id, cycle_number, COALESCE(metadata->>'repairType', 'automatic') AS repair_type
        FROM financial_ledger
        WHERE transaction_type = 'repair_cost' AND cycle_number BETWEEN 1 AND ${totalCycles}
          AND user_id = ANY(${ids.players}::int[])
        GROUP BY 1, 2, 3`,
    ])
    : [[], []];
  return {
    totalCycles,
    balances,
    repairGroups: repairRows.map((row) => ({
      kind: row.kind as RepairGroup['kind'],
      cycle: row.cycle_number,
      repairType: repairTypeOf(row.repair_type),
      repairs: num(row.repairs),
      fullPrice: num(row.full_price),
      afterRepairBay: num(row.after_bay),
      paid: num(row.paid),
    })),
    playerRepairs: playerRepairRows.map((row) => ({ userId: row.user_id, cycle: row.cycle_number, repairType: repairTypeOf(row.repair_type) })),
    groups: rows.map((row) => ({
      kind: row.kind as LedgerGroup['kind'],
      transactionType: row.transaction_type,
      cycle: row.cycle_number,
      income: num(row.income),
      spend: num(row.spend),
    })),
  };
}

async function dataset(fresh: boolean): Promise<Dataset> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = await loadDataset();
  cache = { at: Date.now(), data };
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
): Promise<EconomyOverview> {
  const data = await dataset(options.fresh === true);
  const { totalCycles } = data;
  const fromCycle = windowStart(window, totalCycles);
  const cycles = totalCycles >= fromCycle && totalCycles > 0 ? totalCycles - fromCycle + 1 : 0;
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

  const chartFrom = Math.max(1, Math.min(fromCycle, totalCycles - ECONOMY_CHART_MIN_CYCLES + 1));
  const perCycle: EconomyOverview['perCycle'] = [];
  for (let cycle = chartFrom; cycle <= totalCycles; cycle += 1) {
    const rows = data.groups.filter((g) => inScope(g) && g.cycle === cycle);
    perCycle.push({ cycle, earned: sum(rows.map((g) => g.income)), spent: sum(rows.map((g) => g.spend)) });
  }

  const balances = data.balances[stables];
  const repairs = spendOf(['repair_cost']);
  const battleIncome = incomeOf(['battle_income']);

  return {
    scope: { stables, window, fromCycle, toCycle: totalCycles, cycles },
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
