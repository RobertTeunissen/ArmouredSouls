import type { Prisma } from '../../../../generated/prisma';
import { FinancialErrorCode } from '../../../errors';

const mockResolveCanonicalCycleIdentity = jest.fn();

jest.mock('../../cycle/canonicalCycleIdentity', () => ({
  resolveCanonicalCycleIdentity: (...args: unknown[]) => mockResolveCanonicalCycleIdentity(...args),
}));

import { normalizeFinanceReportPeriod } from '../financeReportPeriod';

function identity(completedCycles: number) {
  return {
    completedCycles,
    activeCycle: completedCycles + 1,
    seasonNumber: 3,
    phase: 'competitive' as const,
    competitiveCyclesCompleted: completedCycles,
    preparationCyclesCompleted: 0,
    seasonStartedAt: new Date('2026-05-01T00:00:00.000Z'),
    isClosing: false,
    closingCycle: null,
  };
}

const tx = {
  auditLog: { findFirst: jest.fn() },
} as unknown as Prisma.TransactionClient;

const AS_OF = new Date('2026-05-05T12:00:00.000Z');

describe('normalizeFinanceReportPeriod unavailable ranges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject a well-formed future range as a typed financial 400', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));

    await expect(normalizeFinanceReportPeriod(
      tx,
      { fromCycle: 4, toCycle: 4 },
      AS_OF,
    )).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_REPORT_PERIOD,
      statusCode: 400,
      message: 'Completed cycle range must be between 1 and 3',
    });
    expect(tx.auditLog.findFirst).not.toHaveBeenCalled();
  });

  it('should return an actionable typed error when no completed cycle exists', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(0));

    await expect(normalizeFinanceReportPeriod(
      tx,
      { fromCycle: 1, toCycle: 1 },
      AS_OF,
    )).rejects.toMatchObject({
      code: FinancialErrorCode.INVALID_REPORT_PERIOD,
      statusCode: 400,
      message: 'No completed financial cycles are available yet. Use Current cycle, or try again after Cycle 1 closes.',
    });
  });
});

describe('normalizeFinanceReportPeriod scopes', () => {
  const findFirst = tx.auditLog.findFirst as jest.Mock;
  const completeAt = (cycle: number): Date => new Date(Date.UTC(2026, 4, 1 + cycle));

  beforeEach(() => {
    jest.clearAllMocks();
    // `cycle_complete` of cycle N is recorded at 1 May + N days.
    findFirst.mockImplementation(async ({ where }: { where: { cycleNumber: number } }) => ({
      eventTimestamp: completeAt(where.cycleNumber),
    }));
  });

  it('reports the active cycle as provisional for the default scope', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));
    const { period, limitations } = await normalizeFinanceReportPeriod(tx, {}, AS_OF);
    expect(period).toMatchObject({
      scope: 'current', fromCycle: 4, toCycle: 4, activeCycle: 4, seasonNumber: 3,
      containsCurrentCycle: true, finality: 'current_provisional',
      startsAt: completeAt(3).toISOString(), endsAt: AS_OF.toISOString(),
    });
    expect(limitations).toEqual([]);
  });

  it('spans cycle 1 to the active cycle for season to date, starting at the season start', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));
    const { period } = await normalizeFinanceReportPeriod(tx, { scope: 'season_to_date' }, AS_OF);
    expect(period).toMatchObject({ fromCycle: 1, toCycle: 4, containsCurrentCycle: true });
    expect(period.startsAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('reports the last completed cycle as historical, ending at its cycle_complete', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));
    const { period } = await normalizeFinanceReportPeriod(tx, { scope: 'last_completed' }, AS_OF);
    expect(period).toMatchObject({
      fromCycle: 3, toCycle: 3, containsCurrentCycle: false, finality: 'completed_historical',
      startsAt: completeAt(2).toISOString(), endsAt: completeAt(3).toISOString(),
    });
  });

  it('caps the last seven cycles at cycle 1', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(10));
    expect((await normalizeFinanceReportPeriod(tx, { scope: 'last_seven' }, AS_OF)).period)
      .toMatchObject({ fromCycle: 4, toCycle: 10 });
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(3));
    expect((await normalizeFinanceReportPeriod(tx, { scope: 'last_seven' }, AS_OF)).period)
      .toMatchObject({ fromCycle: 1, toCycle: 3 });
  });

  it.each(['last_completed', 'last_seven'] as const)(
    'adds a missing_period_boundary limitation for %s before any cycle completed',
    async (scope) => {
      mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(0));
      const { period, limitations } = await normalizeFinanceReportPeriod(tx, { scope }, AS_OF);
      expect(period).toMatchObject({ fromCycle: 1, toCycle: 1, containsCurrentCycle: false });
      expect(limitations).toEqual([expect.objectContaining({ code: 'missing_period_boundary' })]);
    },
  );

  it('defaults a custom range without toCycle to a single cycle', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(5));
    const { period } = await normalizeFinanceReportPeriod(tx, { fromCycle: 2 }, AS_OF);
    expect(period).toMatchObject({ scope: 'custom', fromCycle: 2, toCycle: 2, containsCurrentCycle: false });
  });

  it('falls back to the season start and as-of time when cycle boundaries are missing', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue(identity(5));
    findFirst.mockResolvedValue(null);
    const { period } = await normalizeFinanceReportPeriod(tx, { fromCycle: 2, toCycle: 3 }, AS_OF);
    expect(period.startsAt).toBe('2026-05-01T00:00:00.000Z');
    expect(period.endsAt).toBe(AS_OF.toISOString());
  });

  it('flags a competitive identity mismatch without guessing', async () => {
    mockResolveCanonicalCycleIdentity.mockResolvedValue({ ...identity(3), competitiveCyclesCompleted: 1 });
    const { limitations } = await normalizeFinanceReportPeriod(tx, {}, AS_OF);
    expect(limitations).toEqual([expect.objectContaining({ code: 'cycle_identity_mismatch' })]);
  });
});
