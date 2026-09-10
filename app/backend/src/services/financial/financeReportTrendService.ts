import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import type {
  FinanceHistoryPoint,
  FinanceHistoryResponse,
  ReportPeriodMetadata,
  ReportPeriodSelection,
  SourceProvenance,
} from '../../types';
import {
  calculateEvidenceAwareRevenueGrowth,
  mergeReportLimitations,
  reportLimitationsForCycle,
} from './financeReportComparison';
import { reconcileFinanceStatement } from './financeReportReconciliation';
import { loadFinanceEvidenceView } from './financeReportQueryService';
import { createPlayerSafeSourceReference } from './playerSafeSourceReference';

function actualProvenance(period: ReportPeriodMetadata, current: boolean): SourceProvenance {
  return {
    evidenceKind: 'actual',
    finality: current ? 'current_provisional' : 'completed_historical',
    basis: 'report_period',
    asOf: period.asOf,
  };
}

export async function getFinanceHistory(
  userId: number,
  selection: ReportPeriodSelection,
): Promise<FinanceHistoryResponse> {
  return prisma.$transaction(async (tx) => {
    const [{ asOf }] = await tx.$queryRaw<Array<{ asOf: Date }>>`SELECT CURRENT_TIMESTAMP AS "asOf"`;
    const view = await loadFinanceEvidenceView(tx, userId, selection, asOf);
    const reference = (identity: string): string => createPlayerSafeSourceReference(
      userId,
      view.period.seasonNumber,
      identity,
    );
    const priorCycle = view.period.fromCycle > 1 ? view.period.fromCycle - 1 : null;
    const prior = priorCycle === null
      ? null
      : await loadFinanceEvidenceView(
        tx,
        userId,
        { fromCycle: priorCycle, toCycle: priorCycle },
        asOf,
      );
    let previousRecords = prior?.records ?? null;
    let previousLimitations = prior === null
      ? []
      : reportLimitationsForCycle(prior.limitations, priorCycle!);
    const points: FinanceHistoryPoint[] = [];

    const recordsByCycle = new Map<number, (typeof view.records)[number][]>();
    for (const record of view.records) {
      const bucket = recordsByCycle.get(record.cycleNumber);
      if (bucket) bucket.push(record);
      else recordsByCycle.set(record.cycleNumber, [record]);
    }

    const repairsByCycle = new Map<number, (typeof view.repairEvidence)[number][]>();
    for (const repair of view.repairEvidence) {
      const bucket = repairsByCycle.get(repair.cycleNumber);
      if (bucket) bucket.push(repair);
      else repairsByCycle.set(repair.cycleNumber, [repair]);
    }

    const boundariesByCycle = new Map<number, (typeof view.boundaries)[number][]>();
    for (const boundary of view.boundaries) {
      const bucket = boundariesByCycle.get(boundary.cycleNumber);
      if (bucket) bucket.push(boundary);
      else boundariesByCycle.set(boundary.cycleNumber, [boundary]);
    }

    for (let cycle = view.period.fromCycle; cycle <= view.period.toCycle; cycle += 1) {
      const records = recordsByCycle.get(cycle) ?? [];
      const current = cycle === view.period.activeCycle;
      const period: ReportPeriodMetadata = {
        ...view.period,
        scope: current ? 'current' : 'custom',
        fromCycle: cycle,
        toCycle: cycle,
        containsCurrentCycle: current,
        finality: current ? 'current_provisional' : 'completed_historical',
      };
      const currentLimitations = reportLimitationsForCycle(view.limitations, cycle);
      const reconciled = reconcileFinanceStatement({
        records,
        period,
        repairEvidence: repairsByCycle.get(cycle) ?? [],
        boundaries: boundariesByCycle.get(cycle) ?? [],
        currentCurrency: current ? view.currentCurrency : null,
        initialLimitations: currentLimitations,
        sourceReference: reference,
      });
      const revenueGrowth = calculateEvidenceAwareRevenueGrowth({
        period,
        cycleNumber: cycle,
        currentRecords: records,
        previousRecords,
        currentLimitations,
        previousLimitations,
      });
      const comparisonLimited = revenueGrowth.limitations.length > 0;
      const provenance = actualProvenance(period, current);
      const drivers = [...new Set(records.map((record) => record.transactionType))]
        .map((taxonomy) => {
          const amount = records
            .filter((record) => record.transactionType === taxonomy)
            .reduce((total, record) => total + record.amount, 0);
          const priorAmount = previousRecords
            ?.filter((record) => record.transactionType === taxonomy)
            .reduce((total, record) => total + record.amount, 0) ?? 0;
          const first = records.find((record) => record.transactionType === taxonomy);
          return {
            kind: taxonomy === 'repair_cost'
              ? 'repair_event' as const
              : taxonomy === 'facility_upgrade'
                ? 'facility_upgrade' as const
                : 'financial_delta' as const,
            label: taxonomy.replaceAll('_', ' '),
            description: 'Recorded movement compared with the prior cycle; this is evidence, not proof of causation.',
            amountDelta: comparisonLimited ? null : amount - priorAmount,
            sourceReference: first ? reference(first.financialEventId) : null,
            occurredAt: first?.occurredAt.toISOString() ?? null,
            provenance,
          };
        })
        .sort((left, right) => Math.abs(right.amountDelta ?? 0) - Math.abs(left.amountDelta ?? 0));

      points.push({
        cycleNumber: cycle,
        statement: reconciled.statement,
        revenueGrowth,
        reconciliation: reconciled.reconciliation,
        limitations: reconciled.limitations,
        drivers,
      });
      previousRecords = records;
      previousLimitations = currentLimitations;
    }

    const selected = points.at(-1) ?? null;
    return {
      version: 1,
      period: view.period,
      provenance: [actualProvenance(view.period, view.period.containsCurrentCycle)],
      reconciliation: selected?.reconciliation ?? reconcileFinanceStatement({
        records: [],
        period: view.period,
        repairEvidence: [],
        boundaries: view.boundaries,
        currentCurrency: view.currentCurrency,
        initialLimitations: view.limitations,
        sourceReference: reference,
      }).reconciliation,
      limitations: mergeReportLimitations(...points.map((point) => point.limitations)),
      data: { points, selectedCycle: selected },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}

export const financeReportTrendService = { getHistory: getFinanceHistory };
