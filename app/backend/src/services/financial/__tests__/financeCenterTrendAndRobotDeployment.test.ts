import type { FinancialRecordProjection, ReportPeriodMetadata } from '../../../types';
import type { FinanceEvidenceView } from '../financeReportQueryService';

const mockTransaction = jest.fn();
const mockLoadFinanceEvidenceView = jest.fn();
const mockNormalizeFinanceReportPeriod = jest.fn();
const mockCreateReference = jest.fn((userId: number, seasonNumber: number, identity: string) => `FIN-${userId}-${seasonNumber}-${identity}`);
const mockGetReferenceSecret = jest.fn(() => 'test-finance-reference-secret');

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { $transaction: (...args: unknown[]) => mockTransaction(...args) },
}));
jest.mock('../financeReportQueryService', () => ({
  loadFinanceEvidenceView: (...args: unknown[]) => mockLoadFinanceEvidenceView(...args),
}));
jest.mock('../playerSafeSourceReference', () => ({
  createPlayerSafeSourceReference: (...args: [number, number, string]) => mockCreateReference(...args),
  getFinanceReportReferenceSecret: () => mockGetReferenceSecret(),
}));
jest.mock('../financeReportPeriod', () => ({
  normalizeFinanceReportPeriod: (...args: unknown[]) => mockNormalizeFinanceReportPeriod(...args),
}));

import { getFinanceHistory } from '../financeReportTrendService';
import { getRobotFinancialEvents, getRobotFinancialSummaries } from '../robotDeploymentQueryService';

const AS_OF = new Date('2026-02-04T12:00:00.000Z');

function period(overrides: Partial<ReportPeriodMetadata> = {}): ReportPeriodMetadata {
  return {
    seasonNumber: 8,
    scope: 'custom',
    fromCycle: 2,
    toCycle: 2,
    activeCycle: 3,
    phase: 'competitive',
    containsCurrentCycle: false,
    startsAt: '2026-02-02T00:00:00.000Z',
    endsAt: '2026-02-03T00:00:00.000Z',
    asOf: AS_OF.toISOString(),
    finality: 'completed_historical',
    ...overrides,
  };
}

function record(overrides: Partial<FinancialRecordProjection> = {}): FinancialRecordProjection {
  return {
    financialEventId: 'finance-1',
    cycleNumber: 2,
    sequenceNumber: 1,
    userId: 17,
    robotId: null,
    transactionType: 'battle_income',
    amount: 100,
    balanceAfter: 1_100,
    description: 'Recorded financial movement',
    breakdown: {} as unknown as FinancialRecordProjection['breakdown'],
    occurredAt: new Date('2026-02-02T12:00:00.000Z'),
    ...overrides,
  };
}

function view(overrides: Partial<FinanceEvidenceView> = {}): FinanceEvidenceView {
  return {
    period: period(),
    records: [],
    repairEvidence: [],
    boundaries: [],
    currentCurrency: null,
    limitations: [],
    ...overrides,
  };
}

const tx = {
  $queryRaw: jest.fn(),
  robot: { findMany: jest.fn(), findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  battleParticipant: { findMany: jest.fn() },
  subscription: { findMany: jest.fn() },
  scheduledMatchParticipant: { findMany: jest.fn() },
  teamBattleMember: { findMany: jest.fn() },
};

function mockTransactionBoundary(): void {
  mockTransaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  tx.$queryRaw.mockResolvedValue([{ asOf: AS_OF }]);
}

function mockEmptyExposure(): void {
  tx.subscription.findMany.mockResolvedValue([]);
  tx.scheduledMatchParticipant.findMany.mockResolvedValue([]);
  tx.teamBattleMember.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransactionBoundary();
  mockEmptyExposure();
  tx.robot.findMany.mockResolvedValue([{ id: 4, name: 'Aegis' }]);
  tx.robot.findFirst.mockResolvedValue({ id: 4, name: 'Aegis' });
  tx.user.findUnique.mockResolvedValue({ currency: 1_000 });
  tx.battleParticipant.findMany.mockResolvedValue([]);
});

describe('Finance Center trend service', () => {
  it('should calculate revenue growth from earned taxonomies and exclude sales and costs', async () => {
    const currentRecords = [
      record({ financialEventId: 'battle-current', amount: 200 }),
      record({ financialEventId: 'stream-current', transactionType: 'streaming_revenue', amount: 40 }),
      record({ financialEventId: 'passive-current', transactionType: 'passive_income', amount: 10 }),
      record({ financialEventId: 'achievement-current', transactionType: 'achievement_reward', amount: 5 }),
      record({ financialEventId: 'sale-current', transactionType: 'weapon_sale', amount: 900 }),
      record({ financialEventId: 'repair-current', transactionType: 'repair_cost', amount: -20 }),
      record({ financialEventId: 'facility-current', transactionType: 'facility_upgrade', amount: -50 }),
    ];
    const previousRecords = [
      record({ financialEventId: 'battle-previous', cycleNumber: 1, amount: 100 }),
      record({ financialEventId: 'sale-previous', cycleNumber: 1, transactionType: 'weapon_sale', amount: 800 }),
    ];
    mockLoadFinanceEvidenceView.mockImplementation(async (_tx: unknown, _userId: number, selection: { fromCycle?: number }) => (
      selection.fromCycle === 1
        ? view({ period: period({ fromCycle: 1, toCycle: 1, activeCycle: 3 }), records: previousRecords })
        : view({ records: currentRecords })
    ));

    const result = await getFinanceHistory(17, { fromCycle: 2, toCycle: 2 });

    expect(result.data.selectedCycle?.revenueGrowth).toMatchObject({
      currentEarnedCredits: 255,
      previousEarnedCredits: 100,
      amountDelta: 155,
      percentDelta: 155,
      comparedCycleNumber: 1,
      comparisonBasis: 'completed_to_completed',
    });
  });

  it('should include the provisional current point and every season-to-date cycle in chronological order', async () => {
    const seasonView = view({
      period: period({
        scope: 'season_to_date',
        fromCycle: 1,
        toCycle: 3,
        activeCycle: 3,
        containsCurrentCycle: true,
        finality: 'current_provisional',
      }),
      records: [
        record({ financialEventId: 'cycle-1', cycleNumber: 1, amount: 10 }),
        record({ financialEventId: 'cycle-2', cycleNumber: 2, amount: 20 }),
        record({ financialEventId: 'cycle-3', cycleNumber: 3, amount: 30 }),
      ],
      currentCurrency: 1_060,
    });
    mockLoadFinanceEvidenceView.mockImplementation(async (_tx: unknown, _userId: number, selection: { fromCycle?: number; toCycle?: number }) => (
      selection.fromCycle === 2 && selection.toCycle === 2
        ? view({ period: period({ fromCycle: 2, toCycle: 2, activeCycle: 3 }), records: [record({ financialEventId: 'prior', cycleNumber: 2, amount: 20 })] })
        : seasonView
    ));

    const result = await getFinanceHistory(17, { scope: 'season_to_date' });

    expect(result.data.points.map((point) => point.cycleNumber)).toEqual([1, 2, 3]);
    expect(result.data.points.map((point) => point.revenueGrowth.comparisonBasis)).toEqual([
      'completed_to_completed',
      'completed_to_completed',
      'current_partial_to_completed',
    ]);
    expect(result.data.points[2].statement.provenance.finality).toBe('current_provisional');
    expect(result.data.selectedCycle?.cycleNumber).toBe(3);
  });

  it('should attach a completed-cycle defect only to its statement while limiting the following comparison', async () => {
    const missingPair = {
      code: 'missing_financial_pair' as const,
      message: 'Cycle 1 has excluded financial evidence.',
      affectedCycleNumber: 1,
      affectedSourceReference: 'FIN-CYCLE-1',
    };
    mockLoadFinanceEvidenceView.mockResolvedValue(view({
      period: period({ fromCycle: 1, toCycle: 2, activeCycle: 3 }),
      records: [
        record({ financialEventId: 'cycle-1-valid', cycleNumber: 1, amount: 100 }),
        record({ financialEventId: 'cycle-2-valid', cycleNumber: 2, amount: 200 }),
      ],
      limitations: [missingPair],
    }));

    const result = await getFinanceHistory(17, { fromCycle: 1, toCycle: 2 });
    const [cycleOne, cycleTwo] = result.data.points;

    expect(cycleOne.limitations).toEqual(expect.arrayContaining([missingPair]));
    expect(cycleOne.reconciliation.status).toBe('limited');
    expect(cycleTwo.limitations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ affectedSourceReference: 'FIN-CYCLE-1' }),
    ]));
    expect(cycleTwo.revenueGrowth).toMatchObject({
      currentEarnedCredits: 200,
      previousEarnedCredits: 100,
      amountDelta: null,
      percentDelta: null,
      limitations: [missingPair],
    });
    expect(cycleTwo.drivers.every((driver) => driver.amountDelta === null)).toBe(true);
    expect(result.limitations).toEqual(expect.arrayContaining([missingPair]));
  });

  it('should preserve separately loaded prior-cycle limitations and suppress exact growth', async () => {
    const priorLimitation = {
      code: 'legacy_evidence' as const,
      message: 'Prior-cycle evidence is incomplete.',
      affectedCycleNumber: 1,
      affectedSourceReference: 'FIN-PRIOR',
    };
    mockLoadFinanceEvidenceView.mockImplementation(async (_tx: unknown, _userId: number, selection: { fromCycle?: number }) => (
      selection.fromCycle === 1
        ? view({
          period: period({ fromCycle: 1, toCycle: 1, activeCycle: 3 }),
          records: [record({ financialEventId: 'prior-valid', cycleNumber: 1, amount: 100 })],
          limitations: [priorLimitation],
        })
        : view({ records: [record({ financialEventId: 'current-valid', amount: 250 })] })
    ));

    const result = await getFinanceHistory(17, { fromCycle: 2, toCycle: 2 });

    expect(result.data.selectedCycle?.revenueGrowth).toMatchObject({
      currentEarnedCredits: 250,
      previousEarnedCredits: 100,
      amountDelta: null,
      percentDelta: null,
      limitations: [priorLimitation],
    });
  });
});

describe('Finance Center robot deployment service', () => {
  it('should aggregate conserved evidence in SQL and page only the requested bounded detail rows', async () => {
    const metrics = {
      totalItems: 4,
      foughtMatches: 1,
      battleByeIncome: 125,
      streamingRevenue: 40,
      actualRepairSpend: 10,
      financialRecordCount: 4,
      legacyRecordCount: 0,
      missingLedgerPairCount: 0,
      missingAuditPairCount: 0,
      allocationMismatchCount: 0,
      repairLinkMismatchCount: 0,
    };
    const firstPageRows = [
      { occurredAt: new Date('2026-02-04T10:00:00.000Z'), sourceReference: 'FIN-streaming', eventKind: 'streaming_revenue', mode: 'league_1v1', fought: true, amount: 40, repairType: null },
      { occurredAt: new Date('2026-02-03T10:00:00.000Z'), sourceReference: 'FIN-bye', eventKind: 'bye_income', mode: 'league_1v1', fought: false, amount: 25, repairType: null },
    ];
    const secondPageRows = [
      { occurredAt: new Date('2026-02-02T10:00:00.000Z'), sourceReference: 'FIN-stable', eventKind: 'battle_income', mode: 'league_1v1', fought: true, amount: 100, repairType: null },
      { occurredAt: new Date('2026-02-01T10:00:00.000Z'), sourceReference: 'FIN-repair', eventKind: 'repair_cost', mode: null, fought: false, amount: -10, repairType: 'automatic' },
    ];
    mockNormalizeFinanceReportPeriod.mockResolvedValue({ period: period(), limitations: [] });
    tx.$queryRaw.mockReset();
    tx.$queryRaw
      .mockResolvedValueOnce([{ asOf: AS_OF }])
      .mockResolvedValueOnce([metrics])
      .mockResolvedValueOnce(firstPageRows)
      .mockResolvedValueOnce([{ asOf: AS_OF }])
      .mockResolvedValueOnce([metrics])
      .mockResolvedValueOnce(secondPageRows);

    const firstPage = await getRobotFinancialEvents(17, 4, { fromCycle: 2, toCycle: 2 }, 1, 2);
    const secondPage = await getRobotFinancialEvents(17, 4, { fromCycle: 2, toCycle: 2 }, 2, 2);

    expect(mockLoadFinanceEvidenceView).not.toHaveBeenCalled();
    expect(tx.battleParticipant.findMany).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(6);
    const firstPageQuery = tx.$queryRaw.mock.calls[2]?.[0] as { strings?: readonly string[] };
    expect(firstPageQuery.strings?.join('')).toContain('LIMIT');
    expect(firstPageQuery.strings?.join('')).toContain('OFFSET');
    expect(firstPageQuery.strings?.join('')).toContain('finance_report_source_reference');
    expect(firstPageQuery.strings?.join('')).toContain('finance_report_breakdown_is_valid');
    expect(firstPage.limitations).toEqual([]);
    expect(firstPage.data.robot).toMatchObject({
      foughtMatches: 1,
      battleByeIncome: 125,
      streamingRevenue: 40,
      actualRepairSpend: 10,
      directNet: 155,
      fullPeriodTotal: 155,
    });
    expect(firstPage.data.items.map((item) => item.sourceReference)).toEqual(['FIN-streaming', 'FIN-bye']);
    expect(secondPage.data.items.map((item) => item.sourceReference)).toEqual(['FIN-stable', 'FIN-repair']);
    expect(firstPage.data.pageSubtotal).toBe(65);
    expect(secondPage.data.pageSubtotal).toBe(90);
    expect(firstPage.data.fullPeriodTotal).toBe(155);
    expect(secondPage.data.fullPeriodTotal).toBe(155);
    expect(firstPage.data.page).toMatchObject({ page: 1, totalItems: 4, totalPages: 2, hasNextPage: true });
    expect(secondPage.data.page).toMatchObject({ page: 2, hasNextPage: false });
  });

  it('should surface allocation and repair evidence mismatches without returning unsupported detail rows', async () => {
    mockNormalizeFinanceReportPeriod.mockResolvedValue({ period: period(), limitations: [] });
    tx.$queryRaw.mockReset();
    tx.$queryRaw
      .mockResolvedValueOnce([{ asOf: AS_OF }])
      .mockResolvedValueOnce([{
        totalItems: 0,
        foughtMatches: 0,
        battleByeIncome: 0,
        streamingRevenue: 0,
        actualRepairSpend: 0,
        financialRecordCount: 3,
        legacyRecordCount: 0,
        missingLedgerPairCount: 0,
        missingAuditPairCount: 0,
        allocationMismatchCount: 1,
        repairLinkMismatchCount: 1,
      }])
      .mockResolvedValueOnce([]);

    const result = await getRobotFinancialEvents(17, 4, { fromCycle: 2, toCycle: 2 }, 9, 20);

    expect(result.data.items).toEqual([]);
    expect(result.data.page).toMatchObject({ page: 1, totalItems: 0, totalPages: 1, hasNextPage: false });
    expect(result.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'battle_allocation_mismatch' }),
      expect.objectContaining({ code: 'repair_link_mismatch' }),
    ]));
    expect(result.reconciliation.status).toBe('limited');
  });

  it('should use the canonical SQL evidence boundary for robot summaries', async () => {
    mockNormalizeFinanceReportPeriod.mockResolvedValue({ period: period(), limitations: [] });
    tx.$queryRaw.mockReset();
    tx.$queryRaw
      .mockResolvedValueOnce([{ asOf: AS_OF }])
      .mockResolvedValueOnce([{
        robotId: 4,
        robotName: 'Aegis',
        totalItems: 1,
        foughtMatches: 0,
        battleByeIncome: 0,
        streamingRevenue: 20,
        actualRepairSpend: 0,
        financialRecordCount: 4,
        legacyRecordCount: 0,
        invalidEventRecordCount: 0,
        missingLedgerPairCount: 0,
        missingAuditPairCount: 0,
        allocationMismatchCount: 1,
        repairLinkMismatchCount: 1,
      }]);

    const result = await getRobotFinancialSummaries(17, { fromCycle: 2, toCycle: 2 });

    expect(mockLoadFinanceEvidenceView).not.toHaveBeenCalled();
    expect(tx.battleParticipant.findMany).not.toHaveBeenCalled();
    const summaryQuery = tx.$queryRaw.mock.calls[1]?.[0] as { strings?: readonly string[] };
    const sql = summaryQuery.strings?.join('') ?? '';
    expect(sql).toContain('eligible_robot_events');
    expect(sql).toContain('eligible_direct_battle_events');
    expect(sql).toContain('eligible_repair_events');
    expect(result.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'battle_allocation_mismatch' }),
      expect.objectContaining({ code: 'repair_link_mismatch' }),
    ]));
    expect(result.data).toEqual([
      expect.objectContaining({
        robotId: 4,
        battleByeIncome: 0,
        streamingRevenue: 20,
        actualRepairSpend: 0,
        directNet: 20,
        fullPeriodTotal: 20,
      }),
    ]);
  });
});
