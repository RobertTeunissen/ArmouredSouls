/**
 * Database aggregates behind recorded facility returns (#542).
 *
 * Facility ROI reads the Streaming Studio's and Repair Bay's historical returns
 * from recorded facts (streaming awards in `financial_ledger`, `robot_repair`
 * rows in `audit_logs`). Loading every row grew with the stable's history, so
 * these queries filter and SUM in PostgreSQL, grouped by the stored key the
 * per-row formula depends on. Each returns at most one row per distinct stored
 * `studioMultiplier` / `discountPercent`, whatever the history length.
 *
 * The SQL only filters, resolves the summed amount and groups. Validation of the
 * key and the final arithmetic stay in `recorded-facility-returns.ts`, shared
 * with the per-row reference helpers. The predicates match the row-loading
 * queries they replace, so they use the same indexes
 * (`financial_ledger_user_id_cycle_number_idx`, `audit_logs_user_id_idx`).
 */

import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import type { RepairChargedGroup, StudioStreamingGroup } from './recorded-facility-returns';

const STREAMING_REVENUE_TRANSACTION_TYPE = 'streaming_revenue';
const ROBOT_REPAIR_EVENT_TYPE = 'robot_repair';

interface StudioStreamingGroupRow {
  studioMultiplier: unknown;
  amountSum: number | bigint | Prisma.Decimal | null;
}

interface RepairChargedGroupRow {
  discountPercent: unknown;
  chargedSum: number | bigint | Prisma.Decimal | null;
}

/**
 * The stable's `streaming_revenue` awards in `[fromCycle, toCycle]`, summed per
 * stored `metadata.studioMultiplier`.
 *
 * Only rows whose stored multiplier is a JSON number are grouped; `->` yields
 * NULL for SQL-NULL, JSON-null, array and scalar metadata, which the per-row
 * helper skips too. Range validation (finite, ≥ 1) happens in the caller.
 */
export async function aggregateStudioStreamingByMultiplier(
  userId: number,
  fromCycle: number,
  toCycle: number,
): Promise<StudioStreamingGroup[]> {
  const rows = await prisma.$queryRaw<StudioStreamingGroupRow[]>(Prisma.sql`
    SELECT fl."metadata" -> 'studioMultiplier' AS "studioMultiplier",
           SUM(fl."amount")::float8 AS "amountSum"
    FROM "financial_ledger" fl
    WHERE fl."user_id" = ${userId}
      AND fl."transaction_type" = ${STREAMING_REVENUE_TRANSACTION_TYPE}
      AND fl."cycle_number" BETWEEN ${fromCycle} AND ${toCycle}
      AND jsonb_typeof(fl."metadata" -> 'studioMultiplier') = 'number'
    GROUP BY fl."metadata" -> 'studioMultiplier'
  `);
  return rows.map((row) => ({
    studioMultiplier: row.studioMultiplier,
    amountSum: Number(row.amountSum ?? 0),
  }));
}

/**
 * The stable's `robot_repair` charges in `[fromCycle, toCycle]`, summed per
 * stored `payload.discountPercent`.
 *
 * The charged figure mirrors `readRepairChargedCredits`: the renamed
 * `creditsCharged` first, the legacy `cost` only when `creditsCharged` is not a
 * finite number, never both. The magnitude guard mirrors JS `Number.isFinite`
 * (a JSON number beyond the double range parses to Infinity there). Rows with
 * neither are excluded, as the per-row helper skips them. The sum stays
 * `numeric` (no float overflow error) and is converted with `Number()`.
 */
export async function aggregateRepairChargedByDiscount(
  userId: number,
  fromCycle: number,
  toCycle: number,
): Promise<RepairChargedGroup[]> {
  const rows = await prisma.$queryRaw<RepairChargedGroupRow[]>(Prisma.sql`
    SELECT r."discountPercent", SUM(r."charged") AS "chargedSum"
    FROM (
      SELECT al."payload" -> 'discountPercent' AS "discountPercent",
             CASE
               WHEN jsonb_typeof(al."payload" -> 'creditsCharged') = 'number'
                    AND abs((al."payload" -> 'creditsCharged')::numeric) <= 1.7976931348623157e308
                 THEN (al."payload" -> 'creditsCharged')::numeric
               WHEN jsonb_typeof(al."payload" -> 'cost') = 'number'
                    AND abs((al."payload" -> 'cost')::numeric) <= 1.7976931348623157e308
                 THEN (al."payload" -> 'cost')::numeric
             END AS "charged"
      FROM "audit_logs" al
      WHERE al."user_id" = ${userId}
        AND al."event_type" = ${ROBOT_REPAIR_EVENT_TYPE}
        AND al."cycle_number" BETWEEN ${fromCycle} AND ${toCycle}
        AND jsonb_typeof(al."payload" -> 'discountPercent') = 'number'
    ) r
    WHERE r."charged" IS NOT NULL
    GROUP BY r."discountPercent"
  `);
  return rows.map((row) => ({
    discountPercent: row.discountPercent,
    chargedSum: Number(row.chargedSum ?? 0),
  }));
}
