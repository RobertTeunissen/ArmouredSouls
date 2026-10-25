/**
 * Stable history facts: what an Automaton has recently earned and spent, and
 * how each robot did per event. Read once per turn and carried over when the
 * facts are reloaded after an action, because nothing a turn does changes the
 * past (no battles or settlements run during a Turn_Step).
 *
 * Two consumers, both pure:
 * - the Economy Goal (`goals/economyGoal.ts`) reads `economy`: recurring
 *   income and costs per cycle over the last closed cycles of this season,
 *   normalised so they can be re-priced at any Repair Bay and Streaming
 *   Studio level (`economyEstimate.ts`);
 * - Event_Allocation (`upkeep/subscriptionUpkeep.ts`) reads `eventResults`:
 *   each robot's last battles per event type (income and final HP), so it can
 *   rank events by expected value.
 */
import { Prisma } from '../../../generated/prisma';
import { loadEnvConfig } from '../../config/env';
import { calculateFacilityOperatingCost } from '../../utils/economyFormulas';
import { deriveSeasonState, LEGACY_SEASON_NUMBER } from '../season/seasonService';
import { SUBSCRIBABLE_EVENT_TYPES, type SubscribableEventType } from '../subscription/eventRegistry';
import type { FacilityType, FactsDb } from './stableFacts';

/** Closed cycles the economy window covers (the closed cycle and the two before it). */
export const ECONOMY_WINDOW_CYCLES = 3;

/** Battles per robot and event type kept for Event_Allocation. */
export const EVENT_RESULTS_PER_EVENT = 10;

/**
 * Recurring income and costs per cycle, averaged over the closed cycles of
 * the current season in the window that had any battle income, streaming or
 * repair entry. One-off items (achievement rewards, purchases, sales) are
 * left out.
 */
export interface EconomyFacts {
  /** Closed cycles averaged over (0 = no recurring entries yet this season). */
  cycles: number;
  /** Battle income per cycle (every mode, byes included). */
  battleIncomePerCycle: number;
  /** Streaming revenue per cycle at Studio Multiplier 1: each row divided by its own multiplier. */
  streamingBasePerCycle: number;
  /** Repair cost per cycle before the Repair Bay discount: each row divided by its own (1 − discount). */
  repairBasePerCycle: number;
  /**
   * Operating costs per cycle that facility levels do not explain (roster
   * upkeep): the recorded average minus the facility upkeep at the levels
   * held when the history was read, never below 0.
   */
  otherOperatingPerCycle: number;
  /** Competitive cycles left in the season; null when the season has no fixed length (Season_Zero). */
  remainingCycles: number | null;
}

/** One past battle of a robot in one event type. */
export interface EventObservation {
  /** Battle credits plus streaming revenue the robot was paid. */
  income: number;
  /** Final HP as a percentage of the robot's current max HP, 0–100 (0 = destroyed). */
  hpPercent: number;
}

export interface RobotEventResults {
  robotId: number;
  /** Range band of the robot's current main weapon, null when unarmed. */
  rangeBand: string | null;
  /** Most recent battles first, at most EVENT_RESULTS_PER_EVENT per event type. */
  byEvent: Partial<Record<SubscribableEventType, EventObservation[]>>;
}

export interface StableHistoryFacts {
  economy: EconomyFacts | null;
  /** One entry per live robot (robots without battles have empty `byEvent`). */
  eventResults: RobotEventResults[];
}

export interface StableHistoryInput {
  userId: number;
  seasonNumber: number;
  robotIds: readonly number[];
  /** Facility levels held now (for `otherOperatingPerCycle`). */
  facilities: Readonly<Record<FacilityType, number>>;
}

const SUBSCRIBABLE = new Set<string>(SUBSCRIBABLE_EVENT_TYPES);

interface EconomyRow {
  cycles: number;
  battle: number;
  streaming_base: number;
  repair_base: number;
  operating: number;
}

interface ObservationRow {
  robot_id: number;
  battle_type: string;
  income: number;
  final_hp: number;
  destroyed: boolean;
  max_hp: number;
}

interface RangeBandRow {
  robot_id: number;
  range_band: string | null;
}

/** Facility upkeep per cycle at the given levels (`calculateFacilityOperatingCost`). */
export function facilityUpkeepPerCycle(facilities: Readonly<Record<FacilityType, number>>): number {
  let total = 0;
  for (const [facilityType, level] of Object.entries(facilities)) {
    total += calculateFacilityOperatingCost(facilityType, level);
  }
  return total;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Competitive cycles left after the closed cycle; null for a season without a fixed length. */
async function remainingSeasonCycles(db: FactsDb, seasonNumber: number): Promise<{ remaining: number | null; startedAt: Date | null }> {
  const row = await db.season.findUnique({
    where: { seasonNumber },
    select: { seasonNumber: true, phase: true, competitiveCyclesCompleted: true, preparationCyclesCompleted: true, lengthOverrideCycles: true, startedAt: true },
  });
  if (!row) return { remaining: null, startedAt: null };
  if (row.seasonNumber === LEGACY_SEASON_NUMBER) return { remaining: null, startedAt: row.startedAt };
  const config = loadEnvConfig();
  const state = deriveSeasonState(row, config.seasonLengthCycles, config.preparationLengthCycles);
  const remaining = state.phase === 'competitive'
    ? state.remainingCompetitiveCycles
    : state.phase === 'preparation' ? state.seasonLengthCycles : 0;
  return { remaining, startedAt: row.startedAt };
}

/** Recurring income and costs of the last ECONOMY_WINDOW_CYCLES closed cycles of this season. */
async function loadEconomyFacts(db: FactsDb, input: StableHistoryInput): Promise<EconomyFacts | null> {
  const metadata = await db.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } });
  const closedCycle = metadata?.totalCycles ?? 0;
  const season = await remainingSeasonCycles(db, input.seasonNumber);
  if (closedCycle < 1) return null;
  const fromCycle = closedCycle - ECONOMY_WINDOW_CYCLES + 1;
  const seasonStart = season.startedAt ?? new Date(0);

  // One aggregate over indexed (user_id, cycle_number) rows. Repair and
  // streaming rows are normalised by the discount and multiplier recorded on
  // each row, so a level bought inside the window is priced correctly.
  // Only cycles with a battle, streaming or repair entry count ("active"), and
  // operating costs are summed over those cycles only, so Preparation_Phase
  // cycles (upkeep, no battles) neither dilute nor inflate the averages.
  const rows = await db.$queryRaw<EconomyRow[]>(Prisma.sql`
    WITH window_rows AS (
      SELECT cycle_number, transaction_type, amount, metadata
      FROM financial_ledger
      WHERE user_id = ${input.userId}
        AND cycle_number BETWEEN ${fromCycle} AND ${closedCycle}
        AND created_at >= ${seasonStart}
        AND transaction_type IN ('battle_income', 'streaming_revenue', 'repair_cost', 'operating_costs')
    ), active AS (
      SELECT DISTINCT cycle_number FROM window_rows
      WHERE transaction_type IN ('battle_income', 'streaming_revenue', 'repair_cost')
    )
    SELECT
      (SELECT COUNT(*) FROM active)::int AS cycles,
      COALESCE(SUM(CASE WHEN transaction_type = 'battle_income' THEN amount END), 0)::float8 AS battle,
      COALESCE(SUM(CASE WHEN transaction_type = 'streaming_revenue'
        THEN amount / COALESCE(NULLIF((metadata->>'studioMultiplier')::numeric, 0), 1) END), 0)::float8 AS streaming_base,
      COALESCE(SUM(CASE WHEN transaction_type = 'repair_cost'
        THEN -amount / COALESCE(NULLIF(1 - COALESCE((metadata->>'repairBayDiscountPercent')::numeric, 0) / 100, 0), 1) END), 0)::float8 AS repair_base,
      COALESCE(SUM(CASE WHEN transaction_type = 'operating_costs' THEN -amount END), 0)::float8 AS operating
    FROM window_rows
    WHERE cycle_number IN (SELECT cycle_number FROM active)`);
  const row = rows[0];
  const cycles = row?.cycles ?? 0;
  if (cycles === 0) {
    return {
      cycles: 0,
      battleIncomePerCycle: 0,
      streamingBasePerCycle: 0,
      repairBasePerCycle: 0,
      otherOperatingPerCycle: 0,
      remainingCycles: season.remaining,
    };
  }
  const operatingPerCycle = Number(row.operating) / cycles;
  return {
    cycles,
    battleIncomePerCycle: Number(row.battle) / cycles,
    streamingBasePerCycle: Number(row.streaming_base) / cycles,
    repairBasePerCycle: Number(row.repair_base) / cycles,
    otherOperatingPerCycle: Math.max(0, operatingPerCycle - facilityUpkeepPerCycle(input.facilities)),
    remainingCycles: season.remaining,
  };
}

/** Each robot's last battles per event type and its main weapon's range band. */
async function loadEventResults(db: FactsDb, robotIds: readonly number[]): Promise<RobotEventResults[]> {
  if (robotIds.length === 0) return [];
  const ids = Prisma.join(robotIds.map((id) => Prisma.sql`${id}`));
  const observations = await db.$queryRaw<ObservationRow[]>(Prisma.sql`
    SELECT robot_id, battle_type, income, final_hp, destroyed, max_hp
    FROM (
      SELECT bp.robot_id, b.battle_type, (bp.credits + bp.streaming_revenue) AS income,
             bp.final_hp, bp.destroyed, r.max_hp,
             ROW_NUMBER() OVER (PARTITION BY bp.robot_id, b.battle_type ORDER BY b.created_at DESC, b.id DESC) AS rn
      FROM battle_participants bp
      JOIN battles b ON b.id = bp.battle_id
      JOIN robots r ON r.id = bp.robot_id
      WHERE bp.robot_id IN (${ids}) AND bp.forfeited = false
    ) recent
    WHERE rn <= ${EVENT_RESULTS_PER_EVENT}
    ORDER BY robot_id, battle_type, rn`);
  const bands = await db.$queryRaw<RangeBandRow[]>(Prisma.sql`
    SELECT r.id AS robot_id, w.range_band
    FROM robots r
    LEFT JOIN weapon_inventory wi ON wi.id = r.main_weapon_id
    LEFT JOIN weapons w ON w.id = wi.weapon_id
    WHERE r.id IN (${ids})`);

  const byRobot = new Map<number, RobotEventResults>(robotIds.map((robotId) => [robotId, { robotId, rangeBand: null, byEvent: {} }]));
  for (const band of bands) {
    const entry = byRobot.get(band.robot_id);
    if (entry) entry.rangeBand = band.range_band;
  }
  for (const row of observations) {
    const entry = byRobot.get(row.robot_id);
    if (!entry || !SUBSCRIBABLE.has(row.battle_type)) continue;
    const event = row.battle_type as SubscribableEventType;
    const hpPercent = row.destroyed || row.max_hp <= 0 ? 0 : clampPercent((row.final_hp / row.max_hp) * 100);
    const list = entry.byEvent[event] ?? [];
    list.push({ income: Number(row.income), hpPercent });
    entry.byEvent[event] = list;
  }
  return robotIds.map((robotId) => byRobot.get(robotId) as RobotEventResults);
}

/** Read the history facts of one stable. A fixed number of queries, none per robot. */
export async function loadStableHistory(db: FactsDb, input: StableHistoryInput): Promise<StableHistoryFacts> {
  // Sequential on purpose: `db` may be an interactive-transaction client.
  const economy = await loadEconomyFacts(db, input);
  const eventResults = await loadEventResults(db, input.robotIds);
  return { economy, eventResults };
}
