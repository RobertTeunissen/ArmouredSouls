import type { SearchAnalyticsEventInput } from '../searchAnalyticsTypes';

const mockPrisma = {
  searchAnalyticsEvent: {
    create: jest.fn().mockResolvedValue({ id: BigInt(1) }),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({ id: BigInt(2) }),
  },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import {
  clearSearchAnalyticsPersistenceFailures,
  createSearchAnalyticsEvent,
  hasSearchAnalyticsPersistenceFailure,
  MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES,
  searchAnalyticsStore,
} from '../searchAnalyticsStore';

const eventInput: SearchAnalyticsEventInput = {
  userId: 17,
  seasonNumber: 3,
  cycleNumber: 24,
  eventTimestamp: new Date('2026-09-01T12:34:56.000Z'),
  normalizedPhrase: 'atlas',
  robotResultCount: 2,
  stableResultCount: 1,
  guideResultCount: 3,
  totalResultCount: 6,
  noResult: false,
};

describe('searchAnalyticsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSearchAnalyticsPersistenceFailures();
    mockPrisma.searchAnalyticsEvent.create.mockResolvedValue({ id: BigInt(1) });
    mockPrisma.auditLog.create.mockResolvedValue({ id: BigInt(2) });
  });

  it('should persist the exact server-owned event fields with a narrow select', async () => {
    await searchAnalyticsStore.createEvent(eventInput);

    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledWith({
      data: {
        seasonNumber: 3,
        cycleNumber: 24,
        userId: 17,
        eventTimestamp: eventInput.eventTimestamp,
        normalizedPhrase: 'atlas',
        robotResultCount: 2,
        stableResultCount: 1,
        guideResultCount: 3,
        totalResultCount: 6,
        noResult: false,
      },
      select: { id: true },
    });
  });

  it('should make one attempt, propagate persistence failures, and never fall back to audit logs', async () => {
    const failure = new Error('database unavailable');
    mockPrisma.searchAnalyticsEvent.create.mockRejectedValueOnce(failure);

    await expect(createSearchAnalyticsEvent(eventInput)).rejects.toBe(failure);
    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('keeps persistence-failure status bounded and scoped to season/cycle', async () => {
    for (let cycle = 0; cycle <= MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES; cycle += 1) {
      mockPrisma.searchAnalyticsEvent.create.mockRejectedValueOnce(new Error('unavailable'));
      await expect(createSearchAnalyticsEvent({ ...eventInput, cycleNumber: cycle })).rejects.toThrow('unavailable');
    }

    expect(hasSearchAnalyticsPersistenceFailure({ seasonNumber: eventInput.seasonNumber, cycleFrom: 0, cycleTo: 0 })).toBe(false);
    expect(hasSearchAnalyticsPersistenceFailure({
      seasonNumber: eventInput.seasonNumber,
      cycleFrom: MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES,
      cycleTo: MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES,
    })).toBe(true);
    expect(hasSearchAnalyticsPersistenceFailure({ seasonNumber: eventInput.seasonNumber + 1, cycleFrom: null, cycleTo: null })).toBe(false);
  });

  it('should keep player responses and raw phrases outside the persisted event shape', async () => {
    const playerResponse = {
      robots: [{ category: 'robots', id: 1, label: 'response-only-secret' }],
      stables: [],
      guide: [],
    };
    const inputWithPlayerData = {
      ...eventInput,
      normalizedPhrase: 'server phrase',
      response: playerResponse,
      rawQuery: 'raw query phrase',
      requestUrl: '/api/search?q=raw%20query%20phrase',
    } as unknown as SearchAnalyticsEventInput;

    await createSearchAnalyticsEvent(inputWithPlayerData);

    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ normalizedPhrase: 'server phrase' }),
        select: { id: true },
      }),
    );

    const serializedCall = JSON.stringify(mockPrisma.searchAnalyticsEvent.create.mock.calls);
    expect(serializedCall).not.toContain('response-only-secret');
    expect(serializedCall).not.toContain('raw query phrase');
    expect(serializedCall).not.toContain('/api/search?q=raw%20query%20phrase');
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
