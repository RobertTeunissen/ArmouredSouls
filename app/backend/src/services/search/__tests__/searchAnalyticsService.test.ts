import type { SearchAnalyticsStore } from '../searchAnalyticsTypes';
import { SearchAnalyticsService } from '../searchAnalyticsService';
import type { SearchResponse } from '../searchTypes';

const completedResponse: SearchResponse = {
  robots: [{ category: 'robots', id: 1, label: 'Atlas' }],
  stables: [{ category: 'stables', userId: 9, label: 'Iron House' }],
  guide: [
    {
      category: 'guide',
      title: 'Atlas Guide',
      sectionTitle: 'Combat',
      sectionSlug: 'combat',
      articleSlug: 'atlas-guide',
    },
  ],
};

const activeSeasonContext = { seasonNumber: 4, cycleNumber: 12 };

function createStore(): SearchAnalyticsStore & { createEvent: jest.Mock } {
  return { createEvent: jest.fn().mockResolvedValue(undefined) };
}

describe('SearchAnalyticsService', () => {
  it('should write exactly one complete event and preserve the response for an eligible search', async () => {
    const store = createStore();
    const eventTimestamp = new Date('2026-09-17T12:00:00.000Z');
    const response = await new SearchAnalyticsService({
      store,
      now: () => eventTimestamp,
    }).recordExecutedSearch({
      response: completedResponse,
      normalizedPhrase: 'Atlas',
      activeSeasonContext,
      userId: 42,
    });

    expect(store.createEvent).toHaveBeenCalledTimes(1);
    expect(store.createEvent).toHaveBeenCalledWith({
      userId: 42,
      seasonNumber: 4,
      cycleNumber: 12,
      eventTimestamp,
      normalizedPhrase: 'Atlas',
      robotResultCount: 1,
      stableResultCount: 1,
      guideResultCount: 1,
      totalResultCount: 3,
      noResult: false,
    });
    expect(response).toEqual({
      response: completedResponse,
      attempted: true,
      persisted: true,
      limitation: null,
    });
    expect(response.response).toBe(completedResponse);
  });

  it('should record one zero-result event with no-result status', async () => {
    const store = createStore();
    const emptyResponse: SearchResponse = { robots: [], stables: [], guide: [] };

    await new SearchAnalyticsService({ store }).recordExecutedSearch({
      response: emptyResponse,
      normalizedPhrase: 'missing',
      activeSeasonContext,
      userId: 42,
    });

    expect(store.createEvent).toHaveBeenCalledTimes(1);
    expect(store.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedPhrase: 'missing',
        robotResultCount: 0,
        stableResultCount: 0,
        guideResultCount: 0,
        totalResultCount: 0,
        noResult: true,
      }),
    );
  });

  it('should fail open once without retrying, leaking the phrase, or changing the response', async () => {
    const store = createStore();
    const failureLogger = jest.fn();
    const persistenceFailure = new Error('database contains the secret phrase');
    store.createEvent.mockRejectedValueOnce(persistenceFailure);
    const service = new SearchAnalyticsService({
      store,
      logPersistenceFailure: failureLogger,
    });

    const result = await service.recordExecutedSearch({
      response: completedResponse,
      normalizedPhrase: 'secret phrase',
      activeSeasonContext,
      userId: 42,
    });

    expect(store.createEvent).toHaveBeenCalledTimes(1);
    expect(result.response).toBe(completedResponse);
    expect(result).toMatchObject({
      attempted: true,
      persisted: false,
      limitation: {
        code: 'analyticsDataIncomplete',
      },
    });
    expect(failureLogger).toHaveBeenCalledTimes(1);
    expect(failureLogger).toHaveBeenCalledWith({
      userId: 42,
      eventTimestamp: expect.any(Date),
      seasonNumber: 4,
      cycleNumber: 12,
      resultCounts: { robots: 1, stables: 1, guide: 1, total: 3 },
    });
    expect(JSON.stringify(failureLogger.mock.calls[0])).not.toContain('secret phrase');
    expect(service.getIncompleteTelemetryLimitations()).toEqual([
      {
        code: 'analyticsDataIncomplete',
        message: 'Search analytics data may be incomplete because persistence failed.',
      },
    ]);
  });

  it.each([
    ['short', 'a'],
    ['overlength', 'a'.repeat(101)],
    ['not normalized', ' atlas'],
  ])('should make no attempt for an ineligible %s phrase', async (_description, normalizedPhrase) => {
    const store = createStore();
    const response = await new SearchAnalyticsService({ store }).recordExecutedSearch({
      response: completedResponse,
      normalizedPhrase,
      activeSeasonContext,
      userId: 42,
    });

    expect(store.createEvent).not.toHaveBeenCalled();
    expect(response).toEqual({
      response: completedResponse,
      attempted: false,
      persisted: false,
      limitation: null,
    });
  });

  it('should make no attempt when authenticated server context is invalid', async () => {
    const store = createStore();
    const response = await new SearchAnalyticsService({ store }).recordExecutedSearch({
      response: completedResponse,
      normalizedPhrase: 'atlas',
      activeSeasonContext: { seasonNumber: -1, cycleNumber: 12 },
      userId: 0,
    });

    expect(store.createEvent).not.toHaveBeenCalled();
    expect(response.attempted).toBe(false);
  });
});
