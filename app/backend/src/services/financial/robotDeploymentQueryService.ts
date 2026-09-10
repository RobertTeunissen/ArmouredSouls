import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { AppError } from '../../errors/AppError';
import type {
  ReportLimitation,
  ReportPeriodMetadata,
  ReportPeriodSelection,
  RobotDetailResponse,
  RobotEventExposure,
  RobotFinancialEvent,
  RobotFinancialSummary,
  RobotSummaryResponse,
  SourceProvenance,
} from '../../types';
import { normalizeFinanceReportPeriod } from './financeReportPeriod';
import { getFinanceReportReferenceSecret } from './playerSafeSourceReference';

interface RobotEventMetricsRow {
  totalItems: number;
  foughtMatches: number;
  battleByeIncome: number;
  streamingRevenue: number;
  actualRepairSpend: number;
  financialRecordCount: number;
  legacyRecordCount: number;
  invalidEventRecordCount: number;
  missingLedgerPairCount: number;
  missingAuditPairCount: number;
  allocationMismatchCount: number;
  repairLinkMismatchCount: number;
}

interface RobotSummaryRow extends RobotEventMetricsRow {
  robotId: number;
  robotName: string;
}

interface RobotEventPageRow {
  occurredAt: Date;
  sourceReference: string;
  eventKind: RobotFinancialEvent['eventKind'];
  mode: string | null;
  fought: boolean;
  amount: number;
  repairType: 'manual' | 'automatic' | null;
}

function provenance(asOf: string, finality: 'current_provisional' | 'completed_historical'): SourceProvenance {
  return { evidenceKind: 'actual', finality, basis: 'report_period', asOf };
}

async function loadRobotExposure(
  tx: Prisma.TransactionClient,
  robotId: number,
): Promise<RobotEventExposure> {
  const [subscriptions, directParticipants, memberships] = await Promise.all([
    tx.subscription.findMany({ where: { robotId }, select: { eventType: true }, orderBy: { eventType: 'asc' } }),
    tx.scheduledMatchParticipant.findMany({
      where: { participantType: 'robot', participantId: robotId, scheduledMatch: { status: 'scheduled' } },
      select: { scheduledMatch: { select: { id: true, matchType: true, scheduledFor: true } } },
    }),
    tx.teamBattleMember.findMany({
      where: { robotId },
      select: { slotIndex: true, team: { select: { id: true, teamName: true, teamSize: true } } },
    }),
  ]);
  const teamIds = memberships.map((membership) => membership.team.id);
  const teamParticipants = teamIds.length === 0 ? [] : await tx.scheduledMatchParticipant.findMany({
    where: { participantType: 'team', participantId: { in: teamIds }, scheduledMatch: { status: 'scheduled' } },
    select: { scheduledMatch: { select: { id: true, matchType: true, scheduledFor: true } } },
  });
  const scheduled = new Map<number, { eventType: string; scheduledFor: string }>();
  for (const participant of [...directParticipants, ...teamParticipants]) {
    scheduled.set(participant.scheduledMatch.id, {
      eventType: participant.scheduledMatch.matchType,
      scheduledFor: participant.scheduledMatch.scheduledFor.toISOString(),
    });
  }
  const membership = memberships[0] ?? null;
  return {
    subscriptions: subscriptions.map((subscription) => subscription.eventType),
    outstandingObligations: scheduled.size,
    scheduledEvents: [...scheduled.values()].sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor)),
    teamMembership: membership ? {
      teamName: membership.team.teamName,
      teamSize: membership.team.teamSize,
      role: membership.slotIndex === 0 ? 'active' : 'reserve',
    } : null,
  };
}

/**
 * Canonical robot-attribution boundary shared by summary and detail resources.
 * A robot event exists only when its financial pair, ownership, battle allocation,
 * and repair subtype evidence all agree exactly.
 */
function eligibleRobotEventsCte(
  userId: number,
  period: ReportPeriodMetadata,
): Prisma.Sql {
  return Prisma.sql`
    WITH all_ledgers AS (
      SELECT l.*
      FROM "financial_ledger" l
      WHERE l."user_id" = ${userId}
        AND l."cycle_number" BETWEEN ${period.fromCycle} AND ${period.toCycle}
    ),
    all_financial_audits AS (
      SELECT a.*
      FROM "audit_logs" a
      WHERE a."user_id" = ${userId}
        AND a."cycle_number" BETWEEN ${period.fromCycle} AND ${period.toCycle}
        AND a."event_type" = 'financial_transaction'
        AND a."financial_event_id" IS NOT NULL
    ),
    paired_records AS (
      SELECT
        l."financial_event_id" AS "financialEventId",
        l."user_id" AS "userId",
        l."robot_id" AS "ledgerRobotId",
        l."transaction_type" AS "transactionType",
        l."amount",
        l."metadata",
        l."cycle_number" AS "cycleNumber",
        a."metadata" AS "auditMetadata",
        a."event_timestamp" AS "occurredAt"
      FROM all_ledgers l
      INNER JOIN all_financial_audits a
        ON a."financial_event_id" = l."financial_event_id"
        AND a."cycle_number" = l."cycle_number"
        AND a."user_id" = l."user_id"
        AND a."robot_id" IS NOT DISTINCT FROM l."robot_id"
      WHERE l."financial_event_id" IS NOT NULL
    ),
    event_records AS (
      SELECT *
      FROM paired_records p
      WHERE p."transactionType" IN ('battle_income', 'streaming_revenue', 'repair_cost')
        AND finance_report_breakdown_is_valid(p."metadata", p."transactionType")
    ),
    battle_identity_candidates AS (
      SELECT
        e.*,
        CASE
          WHEN jsonb_typeof(e."metadata"->'battleId') = 'number'
            AND e."metadata"->>'battleId' ~ '^[1-9][0-9]{0,9}$'
            AND (e."metadata"->>'battleId')::BIGINT <= 2147483647
            THEN (e."metadata"->>'battleId')::INTEGER
          ELSE NULL
        END AS "breakdownBattleId",
        CASE
          WHEN jsonb_typeof(e."auditMetadata"->'battleId') = 'number'
            AND e."auditMetadata"->>'battleId' ~ '^[1-9][0-9]{0,9}$'
            AND (e."auditMetadata"->>'battleId')::BIGINT <= 2147483647
            THEN (e."auditMetadata"->>'battleId')::INTEGER
          ELSE NULL
        END AS "auditBattleId",
        CASE
          WHEN COALESCE(e."metadata"->>'sourceEventId', e."financialEventId") ~ '^battle:[1-9][0-9]{0,9}:'
            AND substring(COALESCE(e."metadata"->>'sourceEventId', e."financialEventId") FROM '^battle:([1-9][0-9]{0,9}):')::BIGINT <= 2147483647
            THEN substring(COALESCE(e."metadata"->>'sourceEventId', e."financialEventId") FROM '^battle:([1-9][0-9]{0,9}):')::INTEGER
          ELSE NULL
        END AS "sourceBattleId"
      FROM event_records e
      WHERE e."transactionType" = 'battle_income'
    ),
    battle_records AS (
      SELECT
        c.*,
        CASE
          WHEN (c."breakdownBattleId" IS NULL OR c."auditBattleId" IS NULL OR c."breakdownBattleId" = c."auditBattleId")
            AND (c."breakdownBattleId" IS NULL OR c."sourceBattleId" IS NULL OR c."breakdownBattleId" = c."sourceBattleId")
            AND (c."auditBattleId" IS NULL OR c."sourceBattleId" IS NULL OR c."auditBattleId" = c."sourceBattleId")
            THEN COALESCE(c."breakdownBattleId", c."auditBattleId", c."sourceBattleId")
          ELSE NULL
        END AS "battleId"
      FROM battle_identity_candidates c
    ),
    battle_participant_totals AS (
      SELECT
        b."financialEventId",
        COUNT(owner_robot.id)::INTEGER AS "ownerParticipantCount",
        COALESCE(SUM(CASE WHEN owner_robot.id IS NOT NULL THEN bp."credits" ELSE 0 END), 0)::INTEGER AS "ownerAllocationTotal"
      FROM battle_records b
      LEFT JOIN "battle_participants" bp ON bp."battle_id" = b."battleId"
      LEFT JOIN "robots" owner_robot
        ON owner_robot.id = bp."robot_id"
        AND owner_robot."user_id" = ${userId}
      GROUP BY b."financialEventId"
    ),
    eligible_stable_battle_events AS (
      SELECT
        bp."robot_id" AS "robotId",
        b."financialEventId",
        b."battleId",
        b."occurredAt",
        CASE WHEN b."metadata"->>'isBye' = 'true' THEN 'bye_income' ELSE 'battle_income' END AS "eventKind",
        b."metadata"->>'mode' AS "mode",
        COALESCE(b."metadata"->>'isBye', 'false') <> 'true' AS "fought",
        bp."credits" AS "amount",
        NULL::TEXT AS "repairType"
      FROM battle_records b
      INNER JOIN battle_participant_totals totals
        ON totals."financialEventId" = b."financialEventId"
        AND totals."ownerParticipantCount" > 0
        AND totals."ownerAllocationTotal" = b."amount"
      INNER JOIN "battle_participants" bp ON bp."battle_id" = b."battleId"
      INNER JOIN "robots" owner_robot
        ON owner_robot.id = bp."robot_id"
        AND owner_robot."user_id" = ${userId}
      WHERE b."ledgerRobotId" IS NULL
    ),
    eligible_direct_battle_events AS (
      SELECT
        bp."robot_id" AS "robotId",
        b."financialEventId",
        b."battleId",
        b."occurredAt",
        CASE WHEN b."metadata"->>'isBye' = 'true' THEN 'bye_income' ELSE 'battle_income' END AS "eventKind",
        b."metadata"->>'mode' AS "mode",
        COALESCE(b."metadata"->>'isBye', 'false') <> 'true' AS "fought",
        bp."credits" AS "amount",
        NULL::TEXT AS "repairType"
      FROM battle_records b
      INNER JOIN "battle_participants" bp
        ON bp."battle_id" = b."battleId"
        AND bp."robot_id" = b."ledgerRobotId"
        AND bp."credits" = b."amount"
      INNER JOIN "robots" owner_robot
        ON owner_robot.id = bp."robot_id"
        AND owner_robot."user_id" = ${userId}
      WHERE b."ledgerRobotId" IS NOT NULL
    ),
    eligible_battle_events AS (
      SELECT * FROM eligible_stable_battle_events
      UNION ALL
      SELECT * FROM eligible_direct_battle_events
    ),
    eligible_streaming_events AS (
      SELECT
        e."ledgerRobotId" AS "robotId",
        e."financialEventId",
        NULL::INTEGER AS "battleId",
        e."occurredAt",
        'streaming_revenue'::TEXT AS "eventKind",
        e."metadata"->>'mode' AS "mode",
        TRUE AS "fought",
        e."amount",
        NULL::TEXT AS "repairType"
      FROM event_records e
      INNER JOIN "robots" owner_robot
        ON owner_robot.id = e."ledgerRobotId"
        AND owner_robot."user_id" = ${userId}
      WHERE e."transactionType" = 'streaming_revenue'
        AND e."ledgerRobotId" IS NOT NULL
        AND (e."metadata"->>'robotId')::NUMERIC = e."ledgerRobotId"
    ),
    repair_records AS (
      SELECT e.*
      FROM event_records e
      INNER JOIN "robots" owner_robot
        ON owner_robot.id = e."ledgerRobotId"
        AND owner_robot."user_id" = ${userId}
      WHERE e."transactionType" = 'repair_cost'
        AND e."ledgerRobotId" IS NOT NULL
        AND e."amount" <= 0
        AND (e."metadata"->>'robotId')::NUMERIC = e."ledgerRobotId"
    ),
    eligible_repair_events AS (
      SELECT
        r."ledgerRobotId" AS "robotId",
        r."financialEventId",
        NULL::INTEGER AS "battleId",
        r."occurredAt",
        'repair_cost'::TEXT AS "eventKind",
        NULL::TEXT AS "mode",
        FALSE AS "fought",
        r."amount",
        r."metadata"->>'repairType' AS "repairType"
      FROM repair_records r
      INNER JOIN "audit_logs" repair_audit
        ON repair_audit."event_type" = 'robot_repair'
        AND repair_audit."source_event_id" = r."financialEventId"
        AND repair_audit."user_id" = r."userId"
        AND repair_audit."robot_id" = r."ledgerRobotId"
        AND repair_audit."cycle_number" = r."cycleNumber"
        AND repair_audit."payload"->>'repairType' = r."metadata"->>'repairType'
        AND CASE
          WHEN jsonb_typeof(repair_audit."payload"->'creditsCharged') = 'number'
            THEN (repair_audit."payload"->>'creditsCharged')::NUMERIC
          WHEN jsonb_typeof(repair_audit."payload"->'cost') = 'number'
            THEN (repair_audit."payload"->>'cost')::NUMERIC
          ELSE NULL
        END = ABS(r."amount")::NUMERIC
    ),
    eligible_robot_events AS (
      SELECT * FROM eligible_battle_events
      UNION ALL SELECT * FROM eligible_streaming_events
      UNION ALL SELECT * FROM eligible_repair_events
    ),
    robot_event_rejections AS (
      SELECT
        (SELECT COUNT(*)::INTEGER FROM all_ledgers WHERE "financial_event_id" IS NULL) AS "legacyRecordCount",
        (SELECT COUNT(*)::INTEGER FROM paired_records p
          WHERE p."transactionType" IN ('battle_income', 'streaming_revenue', 'repair_cost')
            AND NOT finance_report_breakdown_is_valid(p."metadata", p."transactionType")) AS "invalidEventRecordCount",
        (SELECT COUNT(*)::INTEGER FROM all_ledgers l
          WHERE l."financial_event_id" IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM all_financial_audits a
              WHERE a."financial_event_id" = l."financial_event_id"
                AND a."cycle_number" = l."cycle_number"
                AND a."user_id" = l."user_id"
                AND a."robot_id" IS NOT DISTINCT FROM l."robot_id"
            )) AS "missingLedgerPairCount",
        (SELECT COUNT(*)::INTEGER FROM all_financial_audits a
          WHERE NOT EXISTS (
            SELECT 1 FROM all_ledgers l
            WHERE l."financial_event_id" = a."financial_event_id"
              AND l."cycle_number" = a."cycle_number"
              AND l."user_id" = a."user_id"
              AND l."robot_id" IS NOT DISTINCT FROM a."robot_id"
          )) AS "missingAuditPairCount",
        (SELECT COUNT(*)::INTEGER
          FROM battle_records b
          LEFT JOIN battle_participant_totals totals ON totals."financialEventId" = b."financialEventId"
          WHERE b."battleId" IS NULL
            OR (b."ledgerRobotId" IS NULL AND (
              COALESCE(totals."ownerParticipantCount", 0) = 0
              OR totals."ownerAllocationTotal" <> b."amount"
            ))
            OR (b."ledgerRobotId" IS NOT NULL AND NOT EXISTS (
              SELECT 1
              FROM "battle_participants" bp
              INNER JOIN "robots" owner_robot
                ON owner_robot.id = bp."robot_id"
                AND owner_robot."user_id" = ${userId}
              WHERE bp."battle_id" = b."battleId"
                AND bp."robot_id" = b."ledgerRobotId"
                AND bp."credits" = b."amount"
            ))) AS "allocationMismatchCount",
        ((SELECT COUNT(*) FROM repair_records) - (SELECT COUNT(*) FROM eligible_repair_events))::INTEGER AS "repairLinkMismatchCount"
    )
  `;
}

function emptyMetrics(): RobotEventMetricsRow {
  return {
    totalItems: 0,
    foughtMatches: 0,
    battleByeIncome: 0,
    streamingRevenue: 0,
    actualRepairSpend: 0,
    financialRecordCount: 0,
    legacyRecordCount: 0,
    invalidEventRecordCount: 0,
    missingLedgerPairCount: 0,
    missingAuditPairCount: 0,
    allocationMismatchCount: 0,
    repairLinkMismatchCount: 0,
  };
}

async function loadRobotSummaryRows(
  tx: Prisma.TransactionClient,
  userId: number,
  period: ReportPeriodMetadata,
): Promise<RobotSummaryRow[]> {
  const cte = eligibleRobotEventsCte(userId, period);
  return tx.$queryRaw<RobotSummaryRow[]>(Prisma.sql`
    ${cte},
    event_totals AS (
      SELECT
        "robotId",
        COUNT(*)::INTEGER AS "totalItems",
        COUNT(DISTINCT "battleId") FILTER (WHERE "fought")::INTEGER AS "foughtMatches",
        COALESCE(SUM("amount") FILTER (WHERE "eventKind" IN ('battle_income', 'bye_income')), 0)::INTEGER AS "battleByeIncome",
        COALESCE(SUM("amount") FILTER (WHERE "eventKind" = 'streaming_revenue'), 0)::INTEGER AS "streamingRevenue",
        COALESCE(SUM(ABS("amount")) FILTER (WHERE "eventKind" = 'repair_cost'), 0)::INTEGER AS "actualRepairSpend"
      FROM eligible_robot_events
      GROUP BY "robotId"
    )
    SELECT
      robot.id AS "robotId",
      robot.name AS "robotName",
      COALESCE(totals."totalItems", 0)::INTEGER AS "totalItems",
      COALESCE(totals."foughtMatches", 0)::INTEGER AS "foughtMatches",
      COALESCE(totals."battleByeIncome", 0)::INTEGER AS "battleByeIncome",
      COALESCE(totals."streamingRevenue", 0)::INTEGER AS "streamingRevenue",
      COALESCE(totals."actualRepairSpend", 0)::INTEGER AS "actualRepairSpend",
      (SELECT COUNT(*)::INTEGER FROM paired_records) AS "financialRecordCount",
      rejected."legacyRecordCount",
      rejected."invalidEventRecordCount",
      rejected."missingLedgerPairCount",
      rejected."missingAuditPairCount",
      rejected."allocationMismatchCount",
      rejected."repairLinkMismatchCount"
    FROM "robots" robot
    CROSS JOIN robot_event_rejections rejected
    LEFT JOIN event_totals totals ON totals."robotId" = robot.id
    WHERE robot."user_id" = ${userId}
    ORDER BY robot.name ASC, robot.id ASC
  `);
}

async function loadRobotEventMetrics(
  tx: Prisma.TransactionClient,
  userId: number,
  robotId: number,
  period: ReportPeriodMetadata,
): Promise<RobotEventMetricsRow> {
  const cte = eligibleRobotEventsCte(userId, period);
  const rows = await tx.$queryRaw<RobotEventMetricsRow[]>(Prisma.sql`
    ${cte}
    SELECT
      COUNT(events."financialEventId")::INTEGER AS "totalItems",
      COUNT(DISTINCT events."battleId") FILTER (WHERE events."fought")::INTEGER AS "foughtMatches",
      COALESCE(SUM(events."amount") FILTER (WHERE events."eventKind" IN ('battle_income', 'bye_income')), 0)::INTEGER AS "battleByeIncome",
      COALESCE(SUM(events."amount") FILTER (WHERE events."eventKind" = 'streaming_revenue'), 0)::INTEGER AS "streamingRevenue",
      COALESCE(SUM(ABS(events."amount")) FILTER (WHERE events."eventKind" = 'repair_cost'), 0)::INTEGER AS "actualRepairSpend",
      (SELECT COUNT(*)::INTEGER FROM paired_records) AS "financialRecordCount",
      rejected."legacyRecordCount",
      rejected."invalidEventRecordCount",
      rejected."missingLedgerPairCount",
      rejected."missingAuditPairCount",
      rejected."allocationMismatchCount",
      rejected."repairLinkMismatchCount"
    FROM robot_event_rejections rejected
    LEFT JOIN eligible_robot_events events ON events."robotId" = ${robotId}
    GROUP BY
      rejected."legacyRecordCount",
      rejected."invalidEventRecordCount",
      rejected."missingLedgerPairCount",
      rejected."missingAuditPairCount",
      rejected."allocationMismatchCount",
      rejected."repairLinkMismatchCount"
  `);
  return rows[0] ?? emptyMetrics();
}

async function loadRobotEventPage(
  tx: Prisma.TransactionClient,
  userId: number,
  robotId: number,
  period: ReportPeriodMetadata,
  pageSize: number,
  offset: number,
): Promise<RobotEventPageRow[]> {
  const cte = eligibleRobotEventsCte(userId, period);
  const sourceReferenceSecret = getFinanceReportReferenceSecret();
  return tx.$queryRaw<RobotEventPageRow[]>(Prisma.sql`
    ${cte},
    referenced_events AS (
      SELECT
        e.*,
        finance_report_source_reference(
          ${userId},
          ${period.seasonNumber},
          e."financialEventId",
          ${sourceReferenceSecret}
        ) AS "sourceReference"
      FROM eligible_robot_events e
      WHERE e."robotId" = ${robotId}
    )
    SELECT "occurredAt", "sourceReference", "eventKind", "mode", "fought", "amount", "repairType"
    FROM referenced_events
    ORDER BY "occurredAt" DESC, "sourceReference" COLLATE "C" ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);
}

function eventLimitations(
  initial: readonly ReportLimitation[],
  metrics: RobotEventMetricsRow,
): ReportLimitation[] {
  const limitations = [...initial];
  if (metrics.legacyRecordCount > 0 || metrics.invalidEventRecordCount > 0) {
    limitations.push({ code: 'legacy_evidence', message: 'Legacy or invalid financial evidence is excluded from robot financial reporting.' });
  }
  if (metrics.missingLedgerPairCount > 0 || metrics.missingAuditPairCount > 0) {
    limitations.push({ code: 'missing_financial_pair', message: 'Incomplete financial pairs are excluded from robot financial reporting.' });
  }
  if (metrics.allocationMismatchCount > 0) {
    limitations.push({ code: 'battle_allocation_mismatch', message: 'A battle award could not be conserved to exact owned participant evidence.' });
  }
  if (metrics.repairLinkMismatchCount > 0) {
    limitations.push({ code: 'repair_link_mismatch', message: 'A repair financial record could not be matched exactly to its subtype evidence.' });
  }
  return limitations;
}

function summaryFromMetrics(
  robotId: number,
  robotName: string,
  metrics: RobotEventMetricsRow,
  limitations: readonly ReportLimitation[],
  source: SourceProvenance,
): RobotFinancialSummary {
  const directNet = metrics.battleByeIncome + metrics.streamingRevenue - metrics.actualRepairSpend;
  return {
    provenance: source,
    robotId,
    robotName,
    foughtMatches: metrics.foughtMatches,
    battleByeIncome: metrics.battleByeIncome,
    streamingRevenue: metrics.streamingRevenue,
    actualRepairSpend: metrics.actualRepairSpend,
    directNet,
    fullPeriodTotal: directNet,
    limitations: [...limitations],
  };
}

export async function getRobotFinancialSummaries(userId: number, selection: ReportPeriodSelection): Promise<RobotSummaryResponse> {
  return prisma.$transaction(async (tx) => {
    const [{ asOf }] = await tx.$queryRaw<Array<{ asOf: Date }>>`SELECT CURRENT_TIMESTAMP AS "asOf"`;
    const normalized = await normalizeFinanceReportPeriod(tx, selection, asOf);
    const [rows, user] = await Promise.all([
      loadRobotSummaryRows(tx, userId, normalized.period),
      tx.user.findUnique({ where: { id: userId }, select: { currency: true } }),
    ]);
    const metrics = rows[0] ?? emptyMetrics();
    const limitations = eventLimitations(normalized.limitations, metrics);
    const source = provenance(normalized.period.asOf, normalized.period.finality);
    const data = rows.map((row) => summaryFromMetrics(row.robotId, row.robotName, row, limitations, source));
    return {
      version: 1,
      period: normalized.period,
      provenance: [source],
      reconciliation: { status: limitations.length ? 'limited' : normalized.period.containsCurrentCycle ? 'provisional' : 'reconciled', orderedBy: 'cycle_number_then_audit_sequence_number', firstOrderKey: null, lastOrderKey: null, financialRecordCount: metrics.financialRecordCount, openingBalance: null, signedMovement: 0, earnedCredits: 0, investmentProceeds: 0, runningCosts: 0, investmentPurchases: 0, closingBalance: null, equationDifference: null, completedCycleBoundaries: [], currentCurrencyConfirmation: normalized.period.containsCurrentCycle ? user?.currency ?? null : null },
      limitations,
      data,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

export async function getRobotFinancialEvents(userId: number, robotId: number, selection: ReportPeriodSelection, page: number, pageSize: number): Promise<RobotDetailResponse> {
  return prisma.$transaction(async (tx) => {
    const [{ asOf }] = await tx.$queryRaw<Array<{ asOf: Date }>>`SELECT CURRENT_TIMESTAMP AS "asOf"`;
    const [normalized, robot] = await Promise.all([
      normalizeFinanceReportPeriod(tx, selection, asOf),
      tx.robot.findFirst({ where: { id: robotId, userId }, select: { id: true, name: true } }),
    ]);
    if (!robot) throw new AppError('FORBIDDEN', 'Access denied', 403);

    const [metrics, exposure] = await Promise.all([
      loadRobotEventMetrics(tx, userId, robot.id, normalized.period),
      loadRobotExposure(tx, robot.id),
    ]);
    const totalPages = Math.max(1, Math.ceil(metrics.totalItems / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const rows = await loadRobotEventPage(tx, userId, robot.id, normalized.period, pageSize, (safePage - 1) * pageSize);
    const source = provenance(normalized.period.asOf, normalized.period.finality);
    const limitations = eventLimitations(normalized.limitations, metrics);
    const summary = summaryFromMetrics(robot.id, robot.name, metrics, limitations, source);
    const items: RobotFinancialEvent[] = rows.map((row) => ({
      provenance: source,
      occurredAt: row.occurredAt.toISOString(),
      sourceReference: row.sourceReference,
      eventKind: row.eventKind,
      mode: row.mode,
      fought: row.fought,
      amount: row.amount,
      repairType: row.repairType,
    }));
    return {
      version: 1,
      period: normalized.period,
      provenance: [source],
      reconciliation: { status: limitations.length ? 'limited' : normalized.period.containsCurrentCycle ? 'provisional' : 'reconciled', orderedBy: 'cycle_number_then_audit_sequence_number', firstOrderKey: null, lastOrderKey: null, financialRecordCount: metrics.financialRecordCount, openingBalance: null, signedMovement: 0, earnedCredits: 0, investmentProceeds: 0, runningCosts: 0, investmentPurchases: 0, closingBalance: null, equationDifference: null, completedCycleBoundaries: [], currentCurrencyConfirmation: null },
      limitations,
      data: {
        robot: summary,
        exposure,
        items,
        page: { page: safePage, pageSize, totalItems: metrics.totalItems, totalPages, hasNextPage: safePage < totalPages, order: 'occurred_at_desc_source_reference_asc' },
        pageSubtotal: items.reduce((total, item) => total + item.amount, 0),
        fullPeriodTotal: summary.fullPeriodTotal,
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

export const robotDeploymentQueryService = { getSummaries: getRobotFinancialSummaries, getEvents: getRobotFinancialEvents };
