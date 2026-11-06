/**
 * Database aggregates over `cycle_snapshots.stable_metrics` for Facility ROI (#550).
 *
 * Facility ROI used to `findMany` every snapshot in the ownership window (and,
 * for the purchase-cycle fallback, the first 100 snapshots) and pick the
 * stable's entry out of each `stableMetrics` array in JS. Every snapshot row
 * carries every stable's metrics, so that read grew with both history length
 * and population. These queries do the same picking and summing in PostgreSQL
 * and return a single row, whatever the history length.
 *
 * Semantics mirror the replaced JS exactly where stored data is well-formed:
 *  - a snapshot whose `stable_metrics` is not a JSON array contributes nothing
 *    (`Array.isArray` guard);
 *  - per snapshot only the FIRST entry whose `userId` equals the stable's id is
 *    used (`Array.prototype.find`);
 *  - a summed field contributes only when it is a JSON number (the JS
 *    `m.field || 0` treated absent/null as 0; non-numeric values are not
 *    written by `cycleSnapshotService` and are excluded here).
 *
 * `cycle_snapshots.cycle_number` is unique and indexed, so the window predicate
 * uses `cycle_snapshots_cycle_number_key`.
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { CYCLE_REPAIR_SPEND_KEY, LEGACY_CYCLE_REPAIR_SPEND_KEY } from './repairPayloadKeys';

/** How many of the oldest snapshots the purchase-cycle fallback inspects. */
export const EARLIEST_ACTIVITY_SNAPSHOT_LIMIT = 100;

/** The stable's snapshot totals over one cycle window. */
export interface StableSnapshotTotals {
  /** Snapshots in the window that carry an entry for the stable. */
  snapshotCount: number;
  merchandisingIncome: number;
  attributeUpgrades: number;
  weaponPurchases: number;
}

/** Facility types whose activity can be detected in a `stableMetrics` entry. */
export type SnapshotActivityFacilityType =
  | 'merchandising_hub'
  | 'streaming_studio'
  | 'repair_bay'
  | 'training_facility'
  | 'weapons_workshop';

interface TotalsRow {
  snapshotCount: number | bigint | null;
  merchandisingIncome: number | bigint | Prisma.Decimal | null;
  attributeUpgrades: number | bigint | Prisma.Decimal | null;
  weaponPurchases: number | bigint | Prisma.Decimal | null;
}

interface EarliestRow {
  cycleNumber: number;
}

/**
 * Lateral subquery yielding the stable's first `stableMetrics` entry of the
 * snapshot aliased `cs`, as column `m.metric`.
 */
function firstStableMetric(userId: number): Prisma.Sql {
  return Prisma.sql`
    CROSS JOIN LATERAL (
      SELECT e.value AS metric
      FROM jsonb_array_elements(
             CASE WHEN jsonb_typeof(cs."stable_metrics") = 'array'
                  THEN cs."stable_metrics" ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS e(value, ord)
      WHERE e.value -> 'userId' = to_jsonb(${userId}::int)
      ORDER BY e.ord
      LIMIT 1
    ) m
  `;
}

/** `m.metric -> key` as numeric when it is a JSON number, else NULL. */
function numericMetric(key: string): Prisma.Sql {
  return Prisma.sql`
    CASE WHEN jsonb_typeof(m.metric -> ${key}::text) = 'number'
         THEN (m.metric -> ${key}::text)::numeric END
  `;
}

/**
 * Cycle_Repair_Spend of `m.metric`, mirroring `readCycleRepairSpend`: the
 * renamed key first, the legacy key only when the renamed one is not a finite
 * number, never both; 0 when neither is.
 */
function cycleRepairSpend(): Prisma.Sql {
  const finite = (key: string): Prisma.Sql => Prisma.sql`
    jsonb_typeof(m.metric -> ${key}::text) = 'number'
    AND abs((m.metric -> ${key}::text)::numeric) <= 1.7976931348623157e308
  `;
  return Prisma.sql`
    CASE
      WHEN ${finite(CYCLE_REPAIR_SPEND_KEY)} THEN (m.metric -> ${CYCLE_REPAIR_SPEND_KEY}::text)::numeric
      WHEN ${finite(LEGACY_CYCLE_REPAIR_SPEND_KEY)} THEN (m.metric -> ${LEGACY_CYCLE_REPAIR_SPEND_KEY}::text)::numeric
      ELSE 0
    END
  `;
}

const ACTIVITY_KEYS: Record<Exclude<SnapshotActivityFacilityType, 'repair_bay'>, string> = {
  merchandising_hub: 'merchandisingIncome',
  streaming_studio: 'streamingIncome',
  training_facility: 'attributeUpgrades',
  weapons_workshop: 'weaponPurchases',
};

/** Per-facility "has activity" predicate over `m.metric` (`hasActivityForFacility`). */
function activityPredicate(facilityType: SnapshotActivityFacilityType): Prisma.Sql {
  if (facilityType === 'repair_bay') {
    return Prisma.sql`${cycleRepairSpend()} > 0`;
  }
  return Prisma.sql`COALESCE(${numericMetric(ACTIVITY_KEYS[facilityType])}, 0) > 0`;
}

/**
 * The stable's summed snapshot metrics over `[fromCycle, toCycle]`, plus how
 * many snapshots in the window have an entry for it (the ROI service uses a
 * non-zero count to choose recorded history over the formula estimate).
 */
export async function aggregateStableSnapshotTotals(
  userId: number,
  fromCycle: number,
  toCycle: number,
): Promise<StableSnapshotTotals> {
  const rows = await prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
    SELECT COUNT(*)::int AS "snapshotCount",
           COALESCE(SUM(${numericMetric('merchandisingIncome')}), 0) AS "merchandisingIncome",
           COALESCE(SUM(${numericMetric('attributeUpgrades')}), 0) AS "attributeUpgrades",
           COALESCE(SUM(${numericMetric('weaponPurchases')}), 0) AS "weaponPurchases"
    FROM "cycle_snapshots" cs
    ${firstStableMetric(userId)}
    WHERE cs."cycle_number" BETWEEN ${fromCycle} AND ${toCycle}
  `);
  const row = rows[0];
  return {
    snapshotCount: Number(row?.snapshotCount ?? 0),
    merchandisingIncome: Number(row?.merchandisingIncome ?? 0),
    attributeUpgrades: Number(row?.attributeUpgrades ?? 0),
    weaponPurchases: Number(row?.weaponPurchases ?? 0),
  };
}

/**
 * The earliest cycle, among the oldest {@link EARLIEST_ACTIVITY_SNAPSHOT_LIMIT}
 * snapshots, in which the stable shows activity for the facility type; `null`
 * when there is none. Same window as the replaced `findMany({ take: 100 })`.
 */
export async function findEarliestSnapshotCycleWithActivity(
  userId: number,
  facilityType: SnapshotActivityFacilityType,
): Promise<number | null> {
  const rows = await prisma.$queryRaw<EarliestRow[]>(Prisma.sql`
    SELECT cs."cycle_number" AS "cycleNumber"
    FROM (
      SELECT "cycle_number", "stable_metrics"
      FROM "cycle_snapshots"
      ORDER BY "cycle_number" ASC
      LIMIT ${EARLIEST_ACTIVITY_SNAPSHOT_LIMIT}
    ) cs
    ${firstStableMetric(userId)}
    WHERE ${activityPredicate(facilityType)}
    ORDER BY cs."cycle_number" ASC
    LIMIT 1
  `);
  return rows[0]?.cycleNumber ?? null;
}
