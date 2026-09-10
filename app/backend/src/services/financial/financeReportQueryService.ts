import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import {
  applyManualRepairDiscount,
  calculateRepairBayDiscountPercent,
  calculateRepairQuote,
  sumAttributes,
} from '../../shared/utils/repairCost';
import type {
  BoundaryEvidence,
  RepairDomainEvidence,
} from './financeReportReconciliation';
import { reconcileFinanceStatement } from './financeReportReconciliation';
import { normalizeFinanceReportPeriod } from './financeReportPeriod';
import { createPlayerSafeSourceReference } from './playerSafeSourceReference';
import { calculatePrestigeMilestoneForecast } from './prestigeMilestoneForecastService';
import {
  calculateEvidenceAwareRevenueGrowth,
  reportLimitationsForCycle,
} from './financeReportComparison';
import type {
  FinanceOverviewResponse,
  FinancialRecordProjection,
  FullDamageRepairReference,
  ReportLimitation,
  ReportPeriodMetadata,
  ReportPeriodSelection,
  SourceProvenance,
  StableMetric,
} from '../../types';
import {
  isTransactionType,
  validateFinancialBreakdown,
} from '../../types';
import { readRepairChargedCredits } from '../economy/repairPayloadKeys';

export interface FinanceEvidenceView {
  period: ReportPeriodMetadata;
  records: FinancialRecordProjection[];
  repairEvidence: RepairDomainEvidence[];
  boundaries: BoundaryEvidence[];
  currentCurrency: number | null;
  limitations: ReportLimitation[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRepairType(payload: unknown): 'manual' | 'automatic' | null {
  if (!isRecord(payload)) return null;
  return payload.repairType === 'manual' || payload.repairType === 'automatic'
    ? payload.repairType
    : null;
}

function readBoundaryBalance(payload: unknown): number | null {
  return isRecord(payload) && Number.isInteger(payload.balance) ? Number(payload.balance) : null;
}

function actualProvenance(period: ReportPeriodMetadata): SourceProvenance {
  return {
    evidenceKind: 'actual',
    finality: period.finality,
    basis: 'report_period',
    asOf: period.asOf,
  };
}

export async function loadFinanceEvidenceView(
  tx: Prisma.TransactionClient,
  userId: number,
  selection: ReportPeriodSelection,
  asOf: Date,
): Promise<FinanceEvidenceView> {
  const normalized = await normalizeFinanceReportPeriod(tx, selection, asOf);
  const { period } = normalized;
  const cycleRange = { gte: period.fromCycle, lte: period.toCycle };
  const [ledgers, financialAudits, repairAudits, boundaryAudits, snapshots, user] = await Promise.all([
    tx.financialLedger.findMany({
      where: { userId, cycleNumber: cycleRange },
      select: {
        financialEventId: true,
        cycleNumber: true,
        userId: true,
        robotId: true,
        transactionType: true,
        amount: true,
        balanceAfter: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    }),
    tx.auditLog.findMany({
      where: {
        userId,
        cycleNumber: cycleRange,
        eventType: 'financial_transaction',
        financialEventId: { not: null },
      },
      select: {
        financialEventId: true,
        cycleNumber: true,
        sequenceNumber: true,
        eventTimestamp: true,
      },
    }),
    tx.auditLog.findMany({
      where: {
        userId,
        cycleNumber: cycleRange,
        eventType: 'robot_repair',
        sourceEventId: { not: null },
      },
      select: { sourceEventId: true, userId: true, robotId: true, cycleNumber: true, payload: true },
    }),
    tx.auditLog.findMany({
      where: { userId, cycleNumber: cycleRange, eventType: 'cycle_end_balance' },
      select: { cycleNumber: true, payload: true, sequenceNumber: true },
      orderBy: [{ cycleNumber: 'asc' }, { sequenceNumber: 'desc' }],
    }),
    tx.cycleSnapshot.findMany({
      where: { cycleNumber: cycleRange },
      select: { cycleNumber: true, stableMetrics: true },
    }),
    tx.user.findUnique({ where: { id: userId }, select: { currency: true } }),
  ]);

  const limitations = [...normalized.limitations];
  const legacyCycles = new Set(
    ledgers
      .filter((ledger) => ledger.financialEventId === null)
      .map((ledger) => ledger.cycleNumber),
  );
  for (const affectedCycleNumber of legacyCycles) {
    limitations.push({
      code: 'legacy_evidence',
      message: 'Legacy financial rows without pair identity are excluded from monetary reporting.',
      affectedCycleNumber,
    });
  }
  const auditByIdentity = new Map(
    financialAudits.map((audit) => [audit.financialEventId as string, audit]),
  );
  const ledgerIdentities = new Set(
    ledgers.flatMap((ledger) => ledger.financialEventId === null ? [] : [ledger.financialEventId]),
  );
  for (const [identity, audit] of auditByIdentity) {
    if (!ledgerIdentities.has(identity)) {
      limitations.push({
        code: 'missing_financial_pair',
        message: 'A financial audit has no paired ledger row and was excluded.',
        affectedCycleNumber: audit.cycleNumber,
        affectedSourceReference: createPlayerSafeSourceReference(userId, period.seasonNumber, identity),
      });
    }
  }
  const records: FinancialRecordProjection[] = [];
  for (const ledger of ledgers) {
    if (!ledger.financialEventId) continue;
    const audit = auditByIdentity.get(ledger.financialEventId);
    if (!audit) {
      limitations.push({
        code: 'missing_financial_pair',
        message: 'A ledger row has no paired financial audit and was excluded.',
        affectedCycleNumber: ledger.cycleNumber,
        affectedSourceReference: createPlayerSafeSourceReference(userId, period.seasonNumber, ledger.financialEventId),
      });
      continue;
    }
    if (!isTransactionType(ledger.transactionType) || !validateFinancialBreakdown(ledger.metadata, ledger.transactionType)) {
      limitations.push({
        code: 'legacy_evidence',
        message: 'A financial pair has invalid stored breakdown facts and was excluded.',
        affectedCycleNumber: ledger.cycleNumber,
        affectedSourceReference: createPlayerSafeSourceReference(userId, period.seasonNumber, ledger.financialEventId),
      });
      continue;
    }
    if (audit.cycleNumber !== ledger.cycleNumber) {
      limitations.push({ code: 'administrative_anomaly', message: 'A financial pair disagrees on cycle identity.' });
      continue;
    }
    records.push({
      financialEventId: ledger.financialEventId,
      cycleNumber: ledger.cycleNumber,
      sequenceNumber: audit.sequenceNumber,
      userId: ledger.userId,
      robotId: ledger.robotId,
      transactionType: ledger.transactionType,
      amount: ledger.amount,
      balanceAfter: ledger.balanceAfter,
      description: ledger.description,
      breakdown: ledger.metadata,
      occurredAt: audit.eventTimestamp,
    });
  }

  const repairEvidence: RepairDomainEvidence[] = repairAudits
    .filter((audit): audit is typeof audit & { sourceEventId: string } => audit.sourceEventId !== null)
    .map((audit) => ({
      sourceEventId: audit.sourceEventId,
      userId: audit.userId,
      robotId: audit.robotId,
      cycleNumber: audit.cycleNumber,
      creditsCharged: readRepairChargedCredits(
        isRecord(audit.payload) ? audit.payload : null,
      ),
      repairType: readRepairType(audit.payload),
    }));

  const boundaryByCycle = new Map<number, number | null>();
  for (const audit of boundaryAudits) {
    if (!boundaryByCycle.has(audit.cycleNumber)) {
      boundaryByCycle.set(audit.cycleNumber, readBoundaryBalance(audit.payload));
    }
  }
  const snapshotByCycle = new Map<number, number | null>();
  for (const snapshot of snapshots) {
    const metrics = snapshot.stableMetrics as unknown as StableMetric[];
    const metric = Array.isArray(metrics) ? metrics.find((item) => item.userId === userId) : undefined;
    snapshotByCycle.set(snapshot.cycleNumber, metric?.balance ?? null);
  }
  const boundaries: BoundaryEvidence[] = [];
  const completedTo = Math.min(period.toCycle, period.activeCycle - 1);
  for (let cycle = period.fromCycle; cycle <= completedTo; cycle += 1) {
    boundaries.push({
      cycleNumber: cycle,
      cycleEndBalance: boundaryByCycle.get(cycle) ?? null,
      snapshotClosingBalance: snapshotByCycle.get(cycle) ?? null,
    });
  }

  return {
    period,
    records,
    repairEvidence,
    boundaries,
    currentCurrency: period.containsCurrentCycle ? user?.currency ?? null : null,
    limitations,
  };
}

async function buildRepairReference(
  tx: Prisma.TransactionClient,
  userId: number,
  period: ReportPeriodMetadata,
): Promise<FullDamageRepairReference> {
  const [robots, repairBay] = await Promise.all([
    tx.robot.findMany({ where: { userId } }),
    tx.facility.findUnique({
      where: { userId_facilityType: { userId, facilityType: 'repair_bay' } },
      select: { level: true },
    }),
  ]);
  const context = {
    repairBayLevel: repairBay?.level ?? 0,
    activeRobotCount: robots.length,
  };
  let automaticAmount = 0;
  let manualAmount = 0;
  for (const robot of robots) {
    const automatic = calculateRepairQuote({
      attributeTotal: sumAttributes(robot),
      damagePercent: 100,
      hpPercent: 0,
    }, context);
    automaticAmount += automatic;
    manualAmount += applyManualRepairDiscount(automatic);
  }
  return {
    provenance: {
      evidenceKind: 'quoted',
      finality: period.finality,
      basis: 'current_context',
      asOf: period.asOf,
    },
    activeRobotCount: robots.length,
    automatic: { amount: automaticAmount, robotCount: robots.length },
    manual: { amount: manualAmount, robotCount: robots.length, saving: automaticAmount - manualAmount },
    repairBayDiscountPercent: calculateRepairBayDiscountPercent(context),
    scenario: 'full_repairable_damage',
  };
}

async function buildRevenueGrowth(
  tx: Prisma.TransactionClient,
  userId: number,
  view: FinanceEvidenceView,
): Promise<FinanceOverviewResponse['data']['revenueGrowth']> {
  const anchorCycle = view.period.toCycle;
  const previousCycle = anchorCycle > 1 ? anchorCycle - 1 : null;
  const previous = previousCycle === null
    ? null
    : await loadFinanceEvidenceView(
      tx,
      userId,
      { fromCycle: previousCycle, toCycle: previousCycle },
      new Date(view.period.asOf),
    );

  return calculateEvidenceAwareRevenueGrowth({
    period: view.period,
    cycleNumber: anchorCycle,
    currentRecords: view.records.filter((record) => record.cycleNumber === anchorCycle),
    previousRecords: previous?.records.filter((record) => record.cycleNumber === previousCycle) ?? null,
    currentLimitations: reportLimitationsForCycle(view.limitations, anchorCycle),
    previousLimitations: previous === null
      ? []
      : reportLimitationsForCycle(previous.limitations, previousCycle!),
  });
}

export async function getFinanceOverview(
  userId: number,
  selection: ReportPeriodSelection,
): Promise<FinanceOverviewResponse> {
  return prisma.$transaction(async (tx) => {
    const [{ asOf }] = await tx.$queryRaw<Array<{ asOf: Date }>>`SELECT CURRENT_TIMESTAMP AS "asOf"`;
    const view = await loadFinanceEvidenceView(tx, userId, selection, asOf);
    const sourceReference = (identity: string): string =>
      createPlayerSafeSourceReference(userId, view.period.seasonNumber, identity);
    const reconciled = reconcileFinanceStatement({
      records: view.records,
      period: view.period,
      repairEvidence: view.repairEvidence,
      boundaries: view.boundaries,
      currentCurrency: view.currentCurrency,
      initialLimitations: view.limitations,
      sourceReference,
    });
    const [repairReference, revenueGrowth, prestigeUser, prestigeAudits] = await Promise.all([
      buildRepairReference(tx, userId, view.period),
      buildRevenueGrowth(tx, userId, view),
      tx.user.findUnique({ where: { id: userId }, select: { prestige: true } }),
      tx.auditLog.findMany({
        where: {
          userId,
          eventType: 'prestige_change',
          cycleNumber: { gte: Math.max(1, view.period.activeCycle - 7), lt: view.period.activeCycle },
        },
        select: { cycleNumber: true, payload: true },
      }),
    ]);
    const sampleMap = new Map<number, number>();
    for (const audit of prestigeAudits) {
      const amount = isRecord(audit.payload) && typeof audit.payload.amount === 'number'
        ? audit.payload.amount
        : 0;
      if (amount > 0) sampleMap.set(audit.cycleNumber, (sampleMap.get(audit.cycleNumber) ?? 0) + amount);
    }
    const forecastProvenance: SourceProvenance = {
      evidenceKind: 'modelled',
      finality: view.period.finality,
      basis: 'completed_sample',
      asOf: view.period.asOf,
    };
    const prestigeForecast = calculatePrestigeMilestoneForecast(
      prestigeUser?.prestige ?? 0,
      [...sampleMap].map(([cycleNumber, positiveAward]) => ({ cycleNumber, positiveAward })),
      forecastProvenance,
    );
    return {
      version: 1,
      period: view.period,
      provenance: [actualProvenance(view.period), repairReference.provenance, forecastProvenance],
      reconciliation: reconciled.reconciliation,
      limitations: reconciled.limitations,
      data: {
        statement: reconciled.statement,
        revenueGrowth,
        repairReference,
        prestigeForecast,
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

export const financeReportQueryService = { getOverview: getFinanceOverview };
