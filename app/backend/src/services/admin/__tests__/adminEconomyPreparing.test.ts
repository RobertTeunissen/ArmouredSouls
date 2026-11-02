/**
 * Economy page while ledger cycles are still being summed: a window answers
 * `preparing` (with progress over the window and its chart) until every cycle
 * it needs is stored, then `ready`. Database and rollups are mocked.
 */
const mockLoadCycleTotals = jest.fn();
const mockPrisma = {
  cycleMetadata: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../season/seasonService', () => ({ getCurrentSeason: jest.fn().mockResolvedValue({ seasonNumber: 1 }) }));
jest.mock('../economyCycleRollups', () => ({ loadCycleTotals: (...args: unknown[]) => mockLoadCycleTotals(...args) }));

import { getEconomyOverview, invalidateEconomyCache } from '../adminEconomyService';

const TOTAL = 40;

function cyclesFrom(first: number): { cycle: number; flows: { kind: string; transactionType: string; income: number; spend: number }[]; repairs: [] }[] {
  return Array.from({ length: TOTAL - first + 1 }, (_, i) => ({
    cycle: first + i,
    flows: [{ kind: 'players', transactionType: 'battle_income', income: 100, spend: 0 }],
    repairs: [],
  }));
}

beforeEach(() => {
  invalidateEconomyCache();
  mockLoadCycleTotals.mockReset();
  mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ totalCycles: TOTAL });
  mockPrisma.user.findMany.mockResolvedValue([]);
});

describe('getEconomyOverview while cycles are summed', () => {
  it('reports progress over the window and its 15-cycle chart', async () => {
    mockLoadCycleTotals.mockResolvedValue({ cycles: cyclesFrom(31), completeFrom: 31 });
    const result = await getEconomyOverview('players', '7');
    // A 7-cycle window ends at 40 and its chart shows 15 cycles: 26..40, of which 31..40 are summed.
    expect(result).toMatchObject({ status: 'preparing', cyclesReady: 10, cyclesNeeded: 15, scope: { fromCycle: 34, toCycle: TOTAL, cycles: 7 } });
  });

  it('is ready once the needed cycles are there, even while older ones are still missing', async () => {
    mockLoadCycleTotals.mockResolvedValue({ cycles: cyclesFrom(26), completeFrom: 26 });
    const week = await getEconomyOverview('players', '7');
    expect(week.status).toBe('ready');
    if (week.status === 'ready') expect(week.kpis.earned).toBe(700);
    const season = await getEconomyOverview('players', 'season');
    expect(season).toMatchObject({ status: 'preparing', cyclesReady: 15, cyclesNeeded: TOTAL });
  });

  it('does not cache an incomplete dataset, so progress shows on the next request', async () => {
    mockLoadCycleTotals.mockResolvedValueOnce({ cycles: cyclesFrom(31), completeFrom: 31 });
    mockLoadCycleTotals.mockResolvedValueOnce({ cycles: cyclesFrom(1), completeFrom: 1 });
    expect((await getEconomyOverview('players', 'season')).status).toBe('preparing');
    expect((await getEconomyOverview('players', 'season')).status).toBe('ready');
    expect(mockLoadCycleTotals).toHaveBeenCalledTimes(2);
    // Complete: the third request is served from the cache.
    await getEconomyOverview('players', '7');
    expect(mockLoadCycleTotals).toHaveBeenCalledTimes(2);
  });
});
