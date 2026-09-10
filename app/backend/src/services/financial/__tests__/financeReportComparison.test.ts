import type { FinancialRecordProjection, ReportLimitation, ReportPeriodMetadata } from '../../../types';
import {
  calculateEvidenceAwareRevenueGrowth,
  mergeReportLimitations,
  reportLimitationsForCycle,
} from '../financeReportComparison';

function period(): ReportPeriodMetadata {
  return {
    seasonNumber: 4,
    scope: 'custom',
    fromCycle: 2,
    toCycle: 2,
    activeCycle: 3,
    phase: 'competitive',
    containsCurrentCycle: false,
    startsAt: '2026-04-02T00:00:00.000Z',
    endsAt: '2026-04-03T00:00:00.000Z',
    asOf: '2026-04-04T12:00:00.000Z',
    finality: 'completed_historical',
  };
}

function record(cycleNumber: number, amount: number, id: string): FinancialRecordProjection {
  return {
    financialEventId: id,
    cycleNumber,
    sequenceNumber: 1,
    userId: 7,
    robotId: null,
    transactionType: 'battle_income',
    amount,
    balanceAfter: 1_000 + amount,
    description: 'Battle reward',
    breakdown: {} as FinancialRecordProjection['breakdown'],
    occurredAt: new Date('2026-04-02T12:00:00.000Z'),
  };
}

const CYCLE_ONE_LIMITATION: ReportLimitation = {
  code: 'missing_financial_pair',
  message: 'Cycle 1 evidence was excluded.',
  affectedCycleNumber: 1,
  affectedSourceReference: 'FIN-CYCLE-1',
};

const RANGE_LIMITATION: ReportLimitation = {
  code: 'cycle_identity_mismatch',
  message: 'The selected range crosses incompatible cycle identity.',
};

describe('Finance report comparison evidence', () => {
  it('should retain exact growth when both cycles have complete evidence', () => {
    const growth = calculateEvidenceAwareRevenueGrowth({
      period: period(),
      cycleNumber: 2,
      currentRecords: [record(2, 250, 'current')],
      previousRecords: [record(1, 100, 'previous')],
      currentLimitations: [],
      previousLimitations: [],
    });

    expect(growth).toMatchObject({
      currentEarnedCredits: 250,
      previousEarnedCredits: 100,
      amountDelta: 150,
      percentDelta: 150,
      comparedCycleNumber: 1,
      limitations: [],
    });
  });

  it.each([
    { side: 'current', currentLimitations: [CYCLE_ONE_LIMITATION], previousLimitations: [] },
    { side: 'previous', currentLimitations: [], previousLimitations: [CYCLE_ONE_LIMITATION] },
  ])('should suppress exact growth when $side-cycle evidence is limited', ({
    currentLimitations,
    previousLimitations,
  }) => {
    const growth = calculateEvidenceAwareRevenueGrowth({
      period: period(),
      cycleNumber: 2,
      currentRecords: [record(2, 250, 'current')],
      previousRecords: [record(1, 100, 'previous')],
      currentLimitations,
      previousLimitations,
    });

    expect(growth.currentEarnedCredits).toBe(250);
    expect(growth.previousEarnedCredits).toBe(100);
    expect(growth.amountDelta).toBeNull();
    expect(growth.percentDelta).toBeNull();
    expect(growth.limitations).toEqual([CYCLE_ONE_LIMITATION]);
  });

  it('should scope cycle limitations without dropping selection-wide limitations', () => {
    const cycleTwoLimitation: ReportLimitation = {
      ...CYCLE_ONE_LIMITATION,
      message: 'Cycle 2 evidence was excluded.',
      affectedCycleNumber: 2,
      affectedSourceReference: 'FIN-CYCLE-2',
    };

    expect(reportLimitationsForCycle(
      [CYCLE_ONE_LIMITATION, cycleTwoLimitation, RANGE_LIMITATION],
      2,
    )).toEqual([cycleTwoLimitation, RANGE_LIMITATION]);
    expect(mergeReportLimitations(
      [CYCLE_ONE_LIMITATION, RANGE_LIMITATION],
      [CYCLE_ONE_LIMITATION],
    )).toEqual([CYCLE_ONE_LIMITATION, RANGE_LIMITATION]);
  });
});
