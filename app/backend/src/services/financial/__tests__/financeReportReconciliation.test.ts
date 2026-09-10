import type { FinancialRecordProjection, ReportPeriodMetadata } from '../../../types';
import { reconcileFinanceStatement } from '../financeReportReconciliation';

const PERIOD: ReportPeriodMetadata = {
  seasonNumber: 1,
  scope: 'last_completed',
  fromCycle: 1,
  toCycle: 1,
  activeCycle: 2,
  phase: 'competitive',
  containsCurrentCycle: false,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-01-02T00:00:00.000Z',
  asOf: '2026-01-02T00:00:00.000Z',
  finality: 'completed_historical',
};

type RepairEvidence = Parameters<typeof reconcileFinanceStatement>[0]['repairEvidence'];
type BoundaryEvidence = Parameters<typeof reconcileFinanceStatement>[0]['boundaries'];

function record(overrides: Partial<FinancialRecordProjection>): FinancialRecordProjection {
  return {
    financialEventId: 'event-1',
    cycleNumber: 1,
    sequenceNumber: 1,
    userId: 5,
    robotId: null,
    transactionType: 'battle_income',
    amount: 100,
    balanceAfter: 1_100,
    description: 'Recorded event',
    breakdown: {} as unknown as FinancialRecordProjection['breakdown'],
    occurredAt: new Date('2026-01-01T12:00:00.000Z'),
    ...overrides,
  };
}

function reconcile(
  records: FinancialRecordProjection[],
  repairEvidence: RepairEvidence = [],
  boundaries: BoundaryEvidence = [{
    cycleNumber: 1,
    cycleEndBalance: records.at(-1)?.balanceAfter ?? 1_000,
    snapshotClosingBalance: records.at(-1)?.balanceAfter ?? 1_000,
  }],
) {
  return reconcileFinanceStatement({
    records,
    period: PERIOD,
    repairEvidence,
    boundaries,
    currentCurrency: null,
    sourceReference: (identity: string): string => `FIN-${identity}`,
  });
}

describe('Finance Center reconciliation', () => {
  it('should expose current currency without fabricating empty-period statement boundaries', () => {
    const currentPeriod: ReportPeriodMetadata = {
      ...PERIOD,
      scope: 'current',
      fromCycle: 2,
      toCycle: 2,
      activeCycle: 2,
      containsCurrentCycle: true,
      finality: 'current_provisional',
    };
    const result = reconcileFinanceStatement({
      records: [],
      period: currentPeriod,
      repairEvidence: [],
      boundaries: [],
      currentCurrency: 1_000,
      sourceReference: (identity) => `FIN-${identity}`,
    });

    expect(result.statement).toMatchObject({
      openingBalance: null,
      netCashMovement: 0,
      closingBalance: null,
    });
    expect(result.reconciliation).toMatchObject({
      status: 'provisional',
      financialRecordCount: 0,
      openingBalance: null,
      signedMovement: 0,
      closingBalance: null,
      currentCurrencyConfirmation: 1_000,
    });
    expect(result.limitations).toEqual([]);
  });

  it('should count a linked repair ledger movement exactly once', () => {
    const repair = record({
      financialEventId: 'repair-1',
      robotId: 9,
      transactionType: 'repair_cost',
      amount: -50,
      balanceAfter: 950,
      breakdown: { repairType: 'manual' } as unknown as FinancialRecordProjection['breakdown'],
    });
    const result = reconcile([repair], [{ sourceEventId: 'repair-1', userId: 5, robotId: 9, cycleNumber: 1, creditsCharged: 50, repairType: 'manual' }]);

    expect(result.reconciliation.signedMovement).toBe(-50);
    expect(result.statement.runningCosts).toBe(50);
    expect(result.statement.runningCostLines).toHaveLength(1);
    expect(result.statement.runningCostLines[0]).toMatchObject({ amount: 50, repairType: 'manual', eventCount: 1 });
  });

  it('should reconcile signed movement and itemised statement equations across categories', () => {
    const records = [
      record({ financialEventId: 'battle', sequenceNumber: 1, amount: 100, balanceAfter: 1_100 }),
      record({ financialEventId: 'sale', sequenceNumber: 2, transactionType: 'weapon_sale', amount: 50, balanceAfter: 1_150 }),
      record({
        financialEventId: 'repair',
        sequenceNumber: 3,
        robotId: 9,
        transactionType: 'repair_cost',
        amount: -20,
        balanceAfter: 1_130,
        breakdown: { repairType: 'automatic' } as unknown as FinancialRecordProjection['breakdown'],
      }),
      record({
        financialEventId: 'operating',
        sequenceNumber: 4,
        transactionType: 'operating_costs',
        amount: -30,
        balanceAfter: 1_100,
        breakdown: {
          costComponents: [
            { name: 'Merchandising Hub', amount: 20, source: 'facility_operating_cost' },
            { name: 'Roster expansion', amount: 10, source: 'roster_expansion' },
          ],
        } as unknown as FinancialRecordProjection['breakdown'],
      }),
      record({ financialEventId: 'purchase', sequenceNumber: 5, transactionType: 'weapon_purchase', amount: -40, balanceAfter: 1_060 }),
    ];
    const result = reconcile(records, [{ sourceEventId: 'repair', userId: 5, robotId: 9, cycleNumber: 1, creditsCharged: 20, repairType: 'automatic' }]);

    expect(result.reconciliation).toMatchObject({
      signedMovement: 60,
      openingBalance: 1_000,
      closingBalance: 1_060,
      earnedCredits: 100,
      investmentProceeds: 50,
      runningCosts: 50,
      investmentPurchases: 40,
      equationDifference: 0,
      status: 'reconciled',
    });
    expect(result.statement.netCashMovement).toBe(60);
    expect(result.limitations).toEqual([]);
  });

  it('should mark both reconciliation equations anomalous when the retained balance chain is inconsistent', () => {
    const result = reconcile([
      record({ financialEventId: 'income', sequenceNumber: 1, amount: 100, balanceAfter: 1_100 }),
      record({ financialEventId: 'purchase', sequenceNumber: 2, transactionType: 'weapon_purchase', amount: -20, balanceAfter: 1_090 }),
    ]);

    expect(result.reconciliation.equationDifference).toBe(-10);
    expect(result.reconciliation.status).toBe('limited');
    expect(result.limitations.filter((limitation) => limitation.code === 'administrative_anomaly')).toHaveLength(2);
  });

  it('should limit an otherwise balanced range when an interior cycle lacks a boundary and disagrees with its snapshot', () => {
    const period = { ...PERIOD, scope: 'custom' as const, toCycle: 3, activeCycle: 4 };
    const records = [
      record({ financialEventId: 'cycle-1', cycleNumber: 1, sequenceNumber: 1, amount: 50, balanceAfter: 1_050 }),
      record({ financialEventId: 'cycle-2', cycleNumber: 2, sequenceNumber: 1, amount: 30, balanceAfter: 1_080 }),
      record({ financialEventId: 'cycle-3', cycleNumber: 3, sequenceNumber: 1, amount: 20, balanceAfter: 1_100 }),
    ];
    const result = reconcileFinanceStatement({
      records,
      period,
      repairEvidence: [],
      boundaries: [
        { cycleNumber: 1, cycleEndBalance: 1_050, snapshotClosingBalance: 1_050 },
        { cycleNumber: 2, cycleEndBalance: null, snapshotClosingBalance: 1_079 },
        { cycleNumber: 3, cycleEndBalance: 1_100, snapshotClosingBalance: 1_100 },
      ],
      currentCurrency: null,
      sourceReference: (identity: string): string => `FIN-${identity}`,
    });

    expect(result.reconciliation.equationDifference).toBe(0);
    expect(result.reconciliation.status).toBe('limited');
    expect(result.reconciliation.completedCycleBoundaries[1]).toMatchObject({ cycleNumber: 2, status: 'limited' });
    expect(result.reconciliation.completedCycleBoundaries[1].limitations.map((limitation) => limitation.code)).toEqual([
      'missing_period_boundary',
      'snapshot_balance_disagreement',
    ]);
  });

  it.each<[string, RepairEvidence]>([
    ['missing evidence', []],
    ['different user', [{ sourceEventId: 'repair-1', userId: 6, robotId: 9, cycleNumber: 1, creditsCharged: 50, repairType: 'manual' }]],
    ['different robot', [{ sourceEventId: 'repair-1', userId: 5, robotId: 10, cycleNumber: 1, creditsCharged: 50, repairType: 'manual' }]],
    ['different cycle', [{ sourceEventId: 'repair-1', userId: 5, robotId: 9, cycleNumber: 2, creditsCharged: 50, repairType: 'manual' }]],
    ['different charged amount', [{ sourceEventId: 'repair-1', userId: 5, robotId: 9, cycleNumber: 1, creditsCharged: 49, repairType: 'manual' }]],
    ['different subtype', [{ sourceEventId: 'repair-1', userId: 5, robotId: 9, cycleNumber: 1, creditsCharged: 50, repairType: 'automatic' }]],
  ])('should exclude a repair display line but retain its single ledger contribution with %s', (_caseName, repairEvidence) => {
    const repair = record({
      financialEventId: 'repair-1',
      robotId: 9,
      transactionType: 'repair_cost',
      amount: -50,
      balanceAfter: 950,
      breakdown: { repairType: 'manual' } as unknown as FinancialRecordProjection['breakdown'],
    });
    const result = reconcile([repair], repairEvidence);

    expect(result.reconciliation.signedMovement).toBe(-50);
    expect(result.statement.runningCosts).toBe(50);
    expect(result.statement.runningCostLines).toEqual([]);
    expect(result.limitations).toContainEqual(expect.objectContaining({ code: 'repair_link_mismatch' }));
  });

  it('should itemise every stored operating-cost component without recomputing the charge', () => {
    const operating = record({
      financialEventId: 'operating-1',
      transactionType: 'operating_costs',
      amount: -900,
      balanceAfter: 100,
      breakdown: {
        costComponents: [
          { name: 'Merchandising Hub', amount: 200, source: 'facility_operating_cost' },
          { name: 'Streaming Studio', amount: 200, source: 'facility_operating_cost' },
          { name: 'Roster expansion', amount: 500, source: 'roster_expansion' },
        ],
      } as unknown as FinancialRecordProjection['breakdown'],
    });
    const result = reconcile([operating]);

    expect(result.statement.runningCosts).toBe(900);
    expect(result.statement.runningCostLines).toEqual([
      expect.objectContaining({ label: 'Merchandising Hub', amount: 200 }),
      expect.objectContaining({ label: 'Streaming Studio', amount: 200 }),
      expect.objectContaining({ label: 'Roster expansion', amount: 500 }),
    ]);
    expect(result.limitations).toEqual([]);
  });

  it('should preserve a zero-valued operating-cost settlement without a legacy-evidence limitation', () => {
    const zeroSettlement = record({
      financialEventId: 'operating-zero',
      transactionType: 'operating_costs',
      amount: 0,
      balanceAfter: 1_000,
      breakdown: { costComponents: [] } as unknown as FinancialRecordProjection['breakdown'],
    });
    const result = reconcile([zeroSettlement]);

    expect(result.statement).toMatchObject({ openingBalance: 1_000, runningCosts: 0, closingBalance: 1_000 });
    expect(result.statement.runningCostLines).toEqual([]);
    expect(result.reconciliation.status).toBe('reconciled');
    expect(result.limitations).toEqual([]);
  });

  it('should classify a positive weapon sale as investment proceeds, not earned credits', () => {
    const sale = record({ transactionType: 'weapon_sale', amount: 250, balanceAfter: 1_250 });
    const result = reconcile([sale]);

    expect(result.statement.earnedCredits).toBe(0);
    expect(result.statement.investmentProceeds).toBe(250);
    expect(result.statement.investmentPurchases).toBe(0);
    expect(result.statement.investmentProceedLines).toHaveLength(1);
  });

  it('should order financial movement by cycle then sequence rather than timestamp', () => {
    const laterCycle = record({ financialEventId: 'later', cycleNumber: 2, sequenceNumber: 1, amount: 50, balanceAfter: 1_150, occurredAt: new Date('2026-01-01T00:00:00.000Z') });
    const earlierCycle = record({ financialEventId: 'earlier', cycleNumber: 1, sequenceNumber: 9, amount: 100, balanceAfter: 1_100, occurredAt: new Date('2026-01-03T00:00:00.000Z') });
    const period = { ...PERIOD, toCycle: 2, activeCycle: 3 };
    const result = reconcileFinanceStatement({ records: [laterCycle, earlierCycle], period, repairEvidence: [], boundaries: [{ cycleNumber: 1, cycleEndBalance: 1_100, snapshotClosingBalance: 1_100 }, { cycleNumber: 2, cycleEndBalance: 1_150, snapshotClosingBalance: 1_150 }], currentCurrency: null, sourceReference: (identity) => `FIN-${identity}` });

    expect(result.reconciliation.firstOrderKey).toEqual({ cycleNumber: 1, sequenceNumber: 9 });
    expect(result.reconciliation.lastOrderKey).toEqual({ cycleNumber: 2, sequenceNumber: 1 });
  });
});
