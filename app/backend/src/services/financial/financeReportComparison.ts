import type {
  FinancialRecordProjection,
  ReportLimitation,
  ReportPeriodMetadata,
  RevenueGrowth,
} from '../../types';

const EARNED_TYPES = new Set([
  'battle_income',
  'streaming_revenue',
  'passive_income',
  'achievement_reward',
]);

function limitationKey(limitation: ReportLimitation): string {
  return [
    limitation.code,
    limitation.message,
    limitation.affectedCycleNumber ?? '',
    limitation.affectedSourceReference ?? '',
  ].join(':');
}

/** Preserve unscoped range limitations and evidence defects belonging to one cycle. */
export function reportLimitationsForCycle(
  limitations: readonly ReportLimitation[],
  cycleNumber: number,
): ReportLimitation[] {
  return limitations.filter((limitation) => (
    limitation.affectedCycleNumber === undefined
    || limitation.affectedCycleNumber === cycleNumber
  ));
}

/** Combine limitation evidence without hiding distinct cycles or source references. */
export function mergeReportLimitations(
  ...groups: ReadonlyArray<readonly ReportLimitation[]>
): ReportLimitation[] {
  return [...new Map(
    groups.flat().map((limitation) => [limitationKey(limitation), limitation]),
  ).values()];
}

function earnedCredits(records: readonly FinancialRecordProjection[]): number {
  return records
    .filter((record) => EARNED_TYPES.has(record.transactionType))
    .reduce((total, record) => total + record.amount, 0);
}

export interface RevenueGrowthEvidence {
  period: ReportPeriodMetadata;
  cycleNumber: number;
  currentRecords: readonly FinancialRecordProjection[];
  previousRecords: readonly FinancialRecordProjection[] | null;
  currentLimitations: readonly ReportLimitation[];
  previousLimitations: readonly ReportLimitation[];
}

/**
 * Calculate one comparison, failing closed when either cycle's retained evidence
 * is limited. Supported earned totals remain visible, but no exact trend is
 * published from a filtered numerator or denominator.
 */
export function calculateEvidenceAwareRevenueGrowth(
  evidence: RevenueGrowthEvidence,
): RevenueGrowth {
  const currentEarnedCredits = earnedCredits(evidence.currentRecords);
  const previousEarnedCredits = evidence.previousRecords === null
    ? null
    : earnedCredits(evidence.previousRecords);
  const limitations = mergeReportLimitations(
    evidence.currentLimitations,
    evidence.previousRecords === null ? [] : evidence.previousLimitations,
  );
  const comparisonAvailable = previousEarnedCredits !== null && limitations.length === 0;
  const amountDelta = comparisonAvailable
    ? currentEarnedCredits - previousEarnedCredits
    : null;

  return {
    provenance: {
      evidenceKind: 'actual',
      finality: evidence.period.finality,
      basis: 'report_period',
      asOf: evidence.period.asOf,
    },
    currentEarnedCredits,
    previousEarnedCredits,
    amountDelta,
    percentDelta: comparisonAvailable && previousEarnedCredits !== 0
      ? (amountDelta! / previousEarnedCredits) * 100
      : null,
    comparedCycleNumber: evidence.cycleNumber > 1 ? evidence.cycleNumber - 1 : null,
    comparisonBasis: evidence.period.containsCurrentCycle
      && evidence.cycleNumber === evidence.period.activeCycle
      ? 'current_partial_to_completed'
      : 'completed_to_completed',
    limitations,
  };
}
