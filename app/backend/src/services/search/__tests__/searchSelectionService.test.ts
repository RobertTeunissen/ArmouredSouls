/**
 * Unit tests for privacy-light selection tracking.
 */
const mockExecuteRaw = jest.fn();
const mockWarn = jest.fn();
const mockGetCurrentSeason = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args) },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { warn: (...args: unknown[]) => mockWarn(...args), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../season/seasonService', () => ({ getCurrentSeason: () => mockGetCurrentSeason() }));

import type { Prisma } from '../../../../generated/prisma';
import { recordSearchSelection, SEARCH_SELECTION_WINDOW_MS } from '../searchSelectionService';

const NOW = new Date('2026-10-22T12:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 2, seasonCycle: 38 });
});

describe('recordSearchSelection', () => {
  it('attaches only the category to the newest untracked-selection search of the player in the window', async () => {
    mockExecuteRaw.mockResolvedValue(1);

    await expect(recordSearchSelection(7, 'guide', NOW)).resolves.toBe('attached');

    const sql = mockExecuteRaw.mock.calls[0][0] as Prisma.Sql;
    const text = sql.strings.join('?');
    expect(text).toContain('SET "selected_category" = ?, "selected_at" = ?');
    expect(text).toContain('"selected_category" IS NULL');
    expect(text).toContain('"selection_tracked" = TRUE');
    expect(text).toContain('ORDER BY "event_timestamp" DESC, "id" DESC');
    expect(text).toContain('LIMIT 1');
    expect(sql.values).toEqual(['guide', NOW, 7, 2, new Date(NOW.getTime() - SEARCH_SELECTION_WINDOW_MS), NOW]);
  });

  it('is a no-op when there is no recent search', async () => {
    mockExecuteRaw.mockResolvedValue(0);
    await expect(recordSearchSelection(7, 'robots', NOW)).resolves.toBe('no_recent_search');
  });

  it('never throws and logs no phrase or result data on failure', async () => {
    mockExecuteRaw.mockRejectedValue(new Error('db down for "laser cannon"'));

    await expect(recordSearchSelection(7, 'stables', NOW)).resolves.toBe('failed');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain('laser cannon');
  });
});
