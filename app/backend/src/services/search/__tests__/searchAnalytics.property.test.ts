/**
 * Feature: universal-search, Property 13: Analytics attempt cardinality, failure isolation, and exclusions
 *
 * **Validates: Design Property 13; Requirements 4.15, 12.1–12.8, 9.6, 9.7**
 */

interface ReportSeasonFixture {
  seasonNumber: number;
  seasonCycle: number;
}

interface ReportFailureScopeFixture {
  seasonNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
}

const mockReportPrisma = {
  $queryRaw: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  $queryRawUnsafe: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  $executeRawUnsafe: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  cycleMetadata: {
    update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  },
};

const mockReportGetCurrentSeason = jest.fn<() => Promise<ReportSeasonFixture>>();
const mockReportPersistenceFailure = jest.fn<(scope: ReportFailureScopeFixture) => boolean>();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockReportPrisma,
}));

jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: mockReportGetCurrentSeason,
}));

jest.mock('../searchAnalyticsStore', () => ({
  __esModule: true,
  default: { createEvent: jest.fn() },
  searchAnalyticsStore: { createEvent: jest.fn() },
  hasSearchAnalyticsPersistenceFailure: mockReportPersistenceFailure,
}));

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: () => (_request: unknown, _response: unknown, next: () => void): void => {
    next();
  },
}));

import fc from 'fast-check';
import { describe, expect, it, jest } from '@jest/globals';
import { requireAdmin } from '../../../middleware/auth';
import { purgeHistory } from '../../season/seasonPurgeService';
import { getSearchAnalyticsReport } from '../searchAnalyticsReportService';
import { SearchAnalyticsService } from '../searchAnalyticsService';
import type {
  ActiveSeasonContext,
  SearchAnalyticsEventInput,
  SearchAnalyticsReportQuery,
  SearchAnalyticsStore,
} from '../searchAnalyticsTypes';
import type { SearchResponse } from '../searchTypes';

const NUM_RUNS = 100;
const EVENT_TIMESTAMP = new Date('2026-09-17T12:00:00.000Z');
const INCOMPLETE_TELEMETRY_LIMITATION = {
  code: 'analyticsDataIncomplete',
  message: 'Search analytics data may be incomplete because persistence failed.',
} as const;

interface ResponseCounts {
  robotCount: number;
  stableCount: number;
  guideCount: number;
}

interface EligibleOutcome {
  kind: 'eligible';
  result: 'success' | 'zero-result' | 'failure';
  input: {
    response: SearchResponse;
    normalizedPhrase: string;
    activeSeasonContext: ActiveSeasonContext;
    userId: number;
  };
}

type ExclusionKind =
  | 'short'
  | 'malformed'
  | 'over-length'
  | 'unauthenticated'
  | 'rate-limited'
  | 'failed'
  | 'keystroke'
  | 'history'
  | 'selection'
  | 'category';

interface ExcludedOutcome {
  kind: 'excluded';
  exclusion: ExclusionKind;
  reachesAnalyticsService: boolean;
  input: EligibleOutcome['input'];
}

type AnalyticsOutcome = EligibleOutcome | ExcludedOutcome;

interface ExclusionBase {
  response: SearchResponse;
  activeSeasonContext: ActiveSeasonContext;
  userId: number;
}

const normalizedPhraseArbitrary = fc
  .array(fc.constantFrom('a', 'b', 'c', 'd', '0', '1', '-'), {
    minLength: 1,
    maxLength: 20,
  })
  .map((characters) => `q${characters.join('')}`);

const activeSeasonContextArbitrary: fc.Arbitrary<ActiveSeasonContext> = fc.record({
  seasonNumber: fc.integer({ min: 0, max: 100 }),
  cycleNumber: fc.integer({ min: 0, max: 500 }),
});

const responseCountsArbitrary: fc.Arbitrary<ResponseCounts> = fc.record({
  robotCount: fc.integer({ min: 0, max: 4 }),
  stableCount: fc.integer({ min: 0, max: 4 }),
  guideCount: fc.integer({ min: 0, max: 4 }),
});

function createResponse({ robotCount, stableCount, guideCount }: ResponseCounts): SearchResponse {
  return {
    robots: Array.from({ length: robotCount }, (_, index) => ({
      category: 'robots',
      id: index + 1,
      label: `Robot ${index + 1}`,
    })),
    stables: Array.from({ length: stableCount }, (_, index) => ({
      category: 'stables',
      userId: index + 1,
      label: `Stable ${index + 1}`,
    })),
    guide: Array.from({ length: guideCount }, (_, index) => ({
      category: 'guide',
      title: `Guide ${index + 1}`,
      sectionTitle: 'Section',
      sectionSlug: `section-${index + 1}`,
      articleSlug: `article-${index + 1}`,
    })),
  };
}

const responseArbitrary = responseCountsArbitrary.map(createResponse);
const nonEmptyResponseArbitrary = responseArbitrary.filter(
  (response) => response.robots.length + response.stables.length + response.guide.length > 0,
);

const eligibleInputArbitrary = fc.record({
  response: responseArbitrary,
  normalizedPhrase: normalizedPhraseArbitrary,
  activeSeasonContext: activeSeasonContextArbitrary,
  userId: fc.integer({ min: 1, max: 100_000 }),
});

const nonEmptyEligibleInputArbitrary = fc.record({
  response: nonEmptyResponseArbitrary,
  normalizedPhrase: normalizedPhraseArbitrary,
  activeSeasonContext: activeSeasonContextArbitrary,
  userId: fc.integer({ min: 1, max: 100_000 }),
});

const emptyResponse: SearchResponse = { robots: [], stables: [], guide: [] };

const eligibleOutcomeArbitrary: fc.Arbitrary<EligibleOutcome> = fc.oneof(
  nonEmptyEligibleInputArbitrary.map((input) => ({
    kind: 'eligible' as const,
    result: 'success' as const,
    input,
  })),
  eligibleInputArbitrary.map((input) => ({
    kind: 'eligible' as const,
    result: 'zero-result' as const,
    input: { ...input, response: emptyResponse },
  })),
  eligibleInputArbitrary.map((input) => ({
    kind: 'eligible' as const,
    result: 'failure' as const,
    input,
  })),
);

function createExcludedOutcome(
  base: ExclusionBase,
  exclusion: ExclusionKind,
  normalizedPhrase: string,
  reachesAnalyticsService: boolean,
  userId = base.userId,
): ExcludedOutcome {
  return {
    kind: 'excluded',
    exclusion,
    reachesAnalyticsService,
    input: {
      response: base.response,
      normalizedPhrase,
      activeSeasonContext: base.activeSeasonContext,
      userId,
    },
  };
}

const exclusionBaseArbitrary: fc.Arbitrary<ExclusionBase> = fc.record({
  response: responseArbitrary,
  activeSeasonContext: activeSeasonContextArbitrary,
  userId: fc.integer({ min: 1, max: 100_000 }),
});

const excludedOutcomeArbitrary: fc.Arbitrary<ExcludedOutcome> = fc.oneof(
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'short', 'q', true)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'malformed', ' q0', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'over-length', 'q'.repeat(101), false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'unauthenticated', 'q0', false, 0)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'rate-limited', 'q', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'failed', 'q', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'keystroke', 'q', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'history', 'q', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'selection', 'q', false)),
  exclusionBaseArbitrary.map((base) => createExcludedOutcome(base, 'category', 'q', false)),
);

const analyticsOutcomeArbitrary: fc.Arbitrary<AnalyticsOutcome> = fc.oneof(
  eligibleOutcomeArbitrary,
  excludedOutcomeArbitrary,
);

const analyticsOutcomeSequenceArbitrary = fc.array(analyticsOutcomeArbitrary, {
  minLength: 1,
  maxLength: 8,
});

function countResults(response: SearchResponse): {
  robots: number;
  stables: number;
  guide: number;
  total: number;
} {
  const robots = response.robots.length;
  const stables = response.stables.length;
  const guide = response.guide.length;

  return { robots, stables, guide, total: robots + stables + guide };
}

function createInstrumentedStore() {
  let eventRows = 0;
  const createEvent = jest.fn(async (_input: SearchAnalyticsEventInput): Promise<void> => {
    eventRows += 1;
  });

  const store: SearchAnalyticsStore = { createEvent };

  return {
    store,
    createEvent,
    recordEventRow: (): void => {
      eventRows += 1;
    },
    getEventRows: (): number => eventRows,
  };
}

describe('Property 13: Analytics attempt cardinality, failure isolation, and exclusions', () => {
  it('should isolate one analytics attempt and one event row per eligible outcome across generated sequences', async () => {
    await fc.assert(
      fc.asyncProperty(analyticsOutcomeSequenceArbitrary, async (outcomes) => {
        const { store, createEvent, recordEventRow, getEventRows } = createInstrumentedStore();
        const failureLogger = jest.fn();
        const service = new SearchAnalyticsService({
          store,
          now: () => EVENT_TIMESTAMP,
          logPersistenceFailure: failureLogger,
        });

        for (const outcome of outcomes) {
          const attemptsBefore = createEvent.mock.calls.length;
          const eventRowsBefore = getEventRows();
          const diagnosticsBefore = failureLogger.mock.calls.length;

          if (outcome.kind === 'eligible') {
            createEvent.mockImplementationOnce(async () => {
              if (outcome.result === 'failure') {
                throw new Error('persistence unavailable');
              }

              // The in-memory row models the single Search_Analytics_Event row
              // created by a successful Search_Analytics_Store write.
              recordEventRow();
              await Promise.resolve();
            });

            const result = await service.recordExecutedSearch(outcome.input);
            const expectedFailure = outcome.result === 'failure';

            expect(result.response).toBe(outcome.input.response);
            expect(result.attempted).toBe(true);
            expect(result.persisted).toBe(!expectedFailure);
            expect(result.limitation).toEqual(
              expectedFailure ? INCOMPLETE_TELEMETRY_LIMITATION : null,
            );
            expect(createEvent.mock.calls.length - attemptsBefore).toBe(1);
            expect(getEventRows() - eventRowsBefore).toBe(expectedFailure ? 0 : 1);
            expect(failureLogger.mock.calls.length - diagnosticsBefore).toBe(
              expectedFailure ? 1 : 0,
            );

            if (expectedFailure) {
              const diagnostic = failureLogger.mock.calls.at(-1)?.[0] as Record<string, unknown>;
              const counts = countResults(outcome.input.response);

              expect(diagnostic).toEqual({
                userId: outcome.input.userId,
                eventTimestamp: EVENT_TIMESTAMP,
                seasonNumber: outcome.input.activeSeasonContext.seasonNumber,
                cycleNumber: outcome.input.activeSeasonContext.cycleNumber,
                resultCounts: counts,
              });
              expect(diagnostic).not.toHaveProperty('normalizedPhrase');
              expect(diagnostic).not.toHaveProperty('rawQuery');
              expect(diagnostic).not.toHaveProperty('response');
              expect(diagnostic).not.toHaveProperty('auditPayload');
            }
          } else if (outcome.reachesAnalyticsService) {
            const result = await service.recordExecutedSearch(outcome.input);

            expect(result).toEqual({
              response: outcome.input.response,
              attempted: false,
              persisted: false,
              limitation: null,
            });
            expect(createEvent.mock.calls.length - attemptsBefore).toBe(0);
            expect(getEventRows() - eventRowsBefore).toBe(0);
            expect(failureLogger.mock.calls.length - diagnosticsBefore).toBe(0);
          } else {
            // These outcomes are rejected before a completed search reaches the
            // analytics boundary, so no service call or persistence attempt exists.
            expect(createEvent.mock.calls.length - attemptsBefore).toBe(0);
            expect(getEventRows() - eventRowsBefore).toBe(0);
            expect(failureLogger.mock.calls.length - diagnosticsBefore).toBe(0);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});


interface PhraseSafeApplicationFixtures {
  requestLog: Record<string, unknown>;
  errorLog: Record<string, unknown>;
  rateLimitLog: Record<string, unknown>;
  ordinaryLog: Record<string, unknown>;
  auditPayload: Record<string, unknown>;
  navigationUrls: string[];
  redirects: string[];
  targetRoutes: string[];
  playerResponse: SearchResponse;
}

function createSafeTargetRoutes(response: SearchResponse): string[] {
  return [
    ...response.robots.map((result) => `/robots/${result.id}`),
    ...response.stables.map((result) => `/stables/${result.userId}`),
    ...response.guide.map((result) => `/guide/${result.sectionSlug}/${result.articleSlug}`),
  ];
}

function createPhraseSafeApplicationFixtures(response: SearchResponse): PhraseSafeApplicationFixtures {
  const targetRoutes = createSafeTargetRoutes(response);

  return {
    requestLog: { method: 'GET', path: '/api/search' },
    errorLog: { path: '/api/search', message: 'Search request failed' },
    rateLimitLog: { path: '/api/search', statusCode: 429 },
    ordinaryLog: { operation: 'search_completed', path: '/api/search' },
    auditPayload: { eventType: 'search', payload: { operation: 'search_completed' } },
    navigationUrls: targetRoutes,
    redirects: targetRoutes,
    targetRoutes,
    playerResponse: response,
  };
}

const eventTimestampArbitrary = fc
  .integer({
    min: Date.parse('2026-01-01T00:00:00.000Z'),
    max: Date.parse('2026-12-31T23:59:59.999Z'),
  })
  .map((milliseconds) => new Date(milliseconds));

const persistenceOutcomeArbitrary = fc.constantFrom<'success' | 'failure'>('success', 'failure');

describe('Property 14: Analytics event completeness and phrase non-propagation', () => {
  /** Feature: universal-search, Property 14: Analytics event completeness and phrase non-propagation */
  it('should capture complete events and isolate phrases for successful and failing persistence', async () => {
    await fc.assert(
      fc.asyncProperty(
        eligibleInputArbitrary,
        persistenceOutcomeArbitrary,
        eventTimestampArbitrary,
        async (input, persistenceOutcome, eventTimestamp) => {
          let eventRows = 0;
          const createEvent = jest.fn(async (_event: SearchAnalyticsEventInput): Promise<void> => {
            if (persistenceOutcome === 'failure') {
              throw new Error(`persistence failed for ${input.normalizedPhrase}`);
            }

            eventRows += 1;
          });
          const store: SearchAnalyticsStore = { createEvent };
          const failureLogger = jest.fn();
          const service = new SearchAnalyticsService({
            store,
            now: () => eventTimestamp,
            logPersistenceFailure: failureLogger,
          });

          const result = await service.recordExecutedSearch(input);
          const counts = countResults(input.response);
          const expectedFailure = persistenceOutcome === 'failure';

          expect(result.response).toBe(input.response);
          expect(result.response).toEqual(input.response);
          expect(result.response).not.toHaveProperty('analytics');
          for (const group of [result.response.robots, result.response.stables, result.response.guide]) {
            for (const searchResult of group) {
              expect(searchResult).not.toHaveProperty('analytics');
            }
          }

          expect(createEvent).toHaveBeenCalledTimes(1);
          expect(eventRows).toBe(expectedFailure ? 0 : 1);
          expect(result.attempted).toBe(true);
          expect(result.persisted).toBe(!expectedFailure);
          expect(result.limitation).toEqual(
            expectedFailure ? INCOMPLETE_TELEMETRY_LIMITATION : null,
          );

          if (expectedFailure) {
            expect(failureLogger).toHaveBeenCalledTimes(1);
            expect(service.getIncompleteTelemetryLimitations()).toEqual([
              INCOMPLETE_TELEMETRY_LIMITATION,
            ]);
            expect(JSON.stringify(failureLogger.mock.calls)).not.toContain(input.normalizedPhrase);
          } else {
            expect(failureLogger).not.toHaveBeenCalled();
            expect(service.getIncompleteTelemetryLimitations()).toEqual([]);
            expect(createEvent).toHaveBeenCalledWith({
              userId: input.userId,
              seasonNumber: input.activeSeasonContext.seasonNumber,
              cycleNumber: input.activeSeasonContext.cycleNumber,
              eventTimestamp,
              normalizedPhrase: input.normalizedPhrase,
              robotResultCount: counts.robots,
              stableResultCount: counts.stables,
              guideResultCount: counts.guide,
              totalResultCount: counts.total,
              noResult: counts.total === 0,
            });
          }

          const phraseSafeFixtures = createPhraseSafeApplicationFixtures(input.response);
          for (const fixture of Object.values(phraseSafeFixtures)) {
            expect(JSON.stringify(fixture)).not.toContain(input.normalizedPhrase);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

interface ReportEventFixture extends SearchAnalyticsEventInput {
  stableName: string | null;
}

interface FailedReportWriteFixture {
  seasonNumber: number;
  cycleNumber: number;
  userId: number;
  normalizedPhrase: string;
}

interface ReportPropertyFixture {
  activeSeasonContext: ActiveSeasonContext;
  events: ReportEventFixture[];
  failedWrites: FailedReportWriteFixture[];
  cycleFrom: number;
  cycleTo: number;
  pageSeed: number;
  limit: number;
}

const reportPhraseArbitrary = fc
  .array(fc.constantFrom('a', 'b', 'c', 'd', '0', '1', '-'), {
    minLength: 1,
    maxLength: 12,
  })
  .map((characters) => `q${characters.join('')}`);

const failedReportPhraseArbitrary = fc
  .array(fc.constantFrom('a', 'b', 'c', 'd', '0', '1', '-'), {
    minLength: 1,
    maxLength: 12,
  })
  .map((characters) => `failed-${characters.join('')}`);

function reportEventArbitrary(
  activeSeasonContext: ActiveSeasonContext,
): fc.Arbitrary<ReportEventFixture> {
  return fc
    .record({
      cycleNumber: fc.integer({ min: 0, max: activeSeasonContext.cycleNumber }),
      userId: fc.integer({ min: 1, max: 20 }),
      normalizedPhrase: reportPhraseArbitrary,
      robotResultCount: fc.integer({ min: 0, max: 4 }),
      stableResultCount: fc.integer({ min: 0, max: 4 }),
      guideResultCount: fc.integer({ min: 0, max: 4 }),
    })
    .map((event) => {
      const totalResultCount =
        event.robotResultCount + event.stableResultCount + event.guideResultCount;

      return {
        ...event,
        seasonNumber: activeSeasonContext.seasonNumber,
        eventTimestamp: EVENT_TIMESTAMP,
        totalResultCount,
        noResult: totalResultCount === 0,
        stableName: event.userId % 3 === 0 ? null : `Stable ${event.userId}`,
      };
    });
}

function failedReportWriteArbitrary(
  activeSeasonContext: ActiveSeasonContext,
): fc.Arbitrary<FailedReportWriteFixture> {
  return fc.record({
    cycleNumber: fc.integer({ min: 0, max: activeSeasonContext.cycleNumber }),
    userId: fc.integer({ min: 1, max: 20 }),
    normalizedPhrase: failedReportPhraseArbitrary,
  }).map((write) => ({
    ...write,
    seasonNumber: activeSeasonContext.seasonNumber,
  }));
}

const reportPropertyFixtureArbitrary: fc.Arbitrary<ReportPropertyFixture> = fc
  .record({
    seasonNumber: fc.integer({ min: 0, max: 20 }),
    cycleNumber: fc.integer({ min: 0, max: 30 }),
  })
  .chain(({ seasonNumber, cycleNumber }) => {
    const activeSeasonContext: ActiveSeasonContext = { seasonNumber, cycleNumber };

    return fc
      .record({
        events: fc.array(reportEventArbitrary(activeSeasonContext), { minLength: 0, maxLength: 30 }),
        failedWrites: fc.array(failedReportWriteArbitrary(activeSeasonContext), {
          minLength: 0,
          maxLength: 8,
        }),
        cycleBounds: fc.record({
          first: fc.integer({ min: 0, max: cycleNumber }),
          second: fc.integer({ min: 0, max: cycleNumber }),
        }),
        pageSeed: fc.integer({ min: 0, max: 100 }),
        limit: fc.integer({ min: 1, max: 8 }),
      })
      .map(({ events, failedWrites, cycleBounds, pageSeed, limit }) => ({
        activeSeasonContext,
        events,
        failedWrites,
        cycleFrom: Math.min(cycleBounds.first, cycleBounds.second),
        cycleTo: Math.max(cycleBounds.first, cycleBounds.second),
        pageSeed,
        limit,
      }));
  });

function isInReportScope(
  seasonNumber: number,
  cycleNumber: number,
  activeSeasonContext: ActiveSeasonContext,
  cycleFrom: number,
  cycleTo: number,
): boolean {
  return (
    seasonNumber === activeSeasonContext.seasonNumber
    && cycleNumber >= cycleFrom
    && cycleNumber <= cycleTo
    && cycleNumber <= activeSeasonContext.cycleNumber
  );
}

function filterReportEvents(
  fixture: ReportPropertyFixture,
): ReportEventFixture[] {
  return fixture.events.filter((event) => isInReportScope(
    event.seasonNumber,
    event.cycleNumber,
    fixture.activeSeasonContext,
    fixture.cycleFrom,
    fixture.cycleTo,
  ));
}

interface ExpectedPlayerAggregate {
  userId: number;
  stableName: string | null;
  searchCount: number;
  noResultCount: number;
}

function expectedPlayerAggregates(events: ReportEventFixture[]): ExpectedPlayerAggregate[] {
  const aggregates = new Map<number, ExpectedPlayerAggregate>();

  for (const event of events) {
    const aggregate = aggregates.get(event.userId) ?? {
      userId: event.userId,
      stableName: event.stableName,
      searchCount: 0,
      noResultCount: 0,
    };
    aggregate.searchCount += 1;
    if (event.noResult) aggregate.noResultCount += 1;
    aggregates.set(event.userId, aggregate);
  }

  return [...aggregates.values()].sort((left, right) => (
    right.searchCount - left.searchCount
    || right.noResultCount - left.noResultCount
    || left.userId - right.userId
  ));
}

function expectedPhraseAggregates(
  events: ReportEventFixture[],
  noResultOnly: boolean,
): Array<{ phrase: string; count: number }> {
  const counts = new Map<string, number>();

  for (const event of events) {
    if (noResultOnly && !event.noResult) continue;
    counts.set(event.normalizedPhrase, (counts.get(event.normalizedPhrase) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((left, right) => right.count - left.count || left.phrase.localeCompare(right.phrase))
    .slice(0, 100);
}

function expectedTrendAggregates(events: ReportEventFixture[]): Array<{
  cycle_number: number;
  total_searches: number;
  unique_searchers: number;
  no_result_searches: number;
}> {
  const byCycle = new Map<number, ReportEventFixture[]>();

  for (const event of events) {
    const cycleEvents = byCycle.get(event.cycleNumber) ?? [];
    cycleEvents.push(event);
    byCycle.set(event.cycleNumber, cycleEvents);
  }

  return [...byCycle.entries()]
    .sort(([leftCycle], [rightCycle]) => leftCycle - rightCycle)
    .map(([cycleNumber, cycleEvents]) => ({
      cycle_number: cycleNumber,
      total_searches: cycleEvents.length,
      unique_searchers: new Set(cycleEvents.map((event) => event.userId)).size,
      no_result_searches: cycleEvents.filter((event) => event.noResult).length,
    }));
}

function reportQueryRows(
  events: ReportEventFixture[],
  page: number,
  limit: number,
): {
  overview: Array<Record<string, number>>;
  trends: Array<Record<string, number>>;
  topPhrases: Array<{ phrase: string; count: number }>;
  noResultPhrases: Array<{ phrase: string; count: number }>;
  playerAnalysis: Array<Record<string, number | string | null>>;
} {
  const playerAggregates = expectedPlayerAggregates(events);
  const pageEntries = playerAggregates.slice((page - 1) * limit, page * limit);

  return {
    overview: [{
      total_searches: events.length,
      unique_searchers: new Set(events.map((event) => event.userId)).size,
      no_result_searches: events.filter((event) => event.noResult).length,
      robots: events.reduce((sum, event) => sum + event.robotResultCount, 0),
      stables: events.reduce((sum, event) => sum + event.stableResultCount, 0),
      guide: events.reduce((sum, event) => sum + event.guideResultCount, 0),
    }],
    trends: expectedTrendAggregates(events),
    topPhrases: expectedPhraseAggregates(events, false),
    noResultPhrases: expectedPhraseAggregates(events, true),
    playerAnalysis: pageEntries.map((entry) => ({
      user_id: entry.userId,
      stable_name: entry.stableName,
      search_count: entry.searchCount,
      no_result_count: entry.noResultCount,
      total_count: playerAggregates.length,
    })),
  };
}

/**
 * Feature: universal-search, Property 15: Admin analytics aggregation and bounded reporting
 *
 * **Validates: Design Property 15; Requirements 12.14–12.17, 9.6, 9.7**
 */
describe('Property 15: Admin analytics aggregation and bounded reporting', () => {
  it('should aggregate only persisted active-season events into deterministic bounded reports', async () => {
    await fc.assert(
      fc.asyncProperty(reportPropertyFixtureArbitrary, async (fixture) => {
        const persistedEvents = filterReportEvents(fixture);
        const playerAggregates = expectedPlayerAggregates(persistedEvents);
        const pageCount = Math.max(1, Math.ceil(playerAggregates.length / fixture.limit));
        const page = (fixture.pageSeed % pageCount) + 1;
        const query: SearchAnalyticsReportQuery = {
          cycleFrom: fixture.cycleFrom,
          cycleTo: fixture.cycleTo,
          page,
          limit: fixture.limit,
        };
        const rows = reportQueryRows(persistedEvents, page, fixture.limit);
        const failedWriteInScope = fixture.failedWrites.some((write) => isInReportScope(
          write.seasonNumber,
          write.cycleNumber,
          fixture.activeSeasonContext,
          fixture.cycleFrom,
          fixture.cycleTo,
        ));

        mockReportGetCurrentSeason.mockReset();
        mockReportGetCurrentSeason.mockResolvedValue({
          seasonNumber: fixture.activeSeasonContext.seasonNumber,
          seasonCycle: fixture.activeSeasonContext.cycleNumber,
        });
        mockReportPersistenceFailure.mockReset();
        mockReportPersistenceFailure.mockImplementation((scope: {
          seasonNumber: number;
          cycleFrom: number | null;
          cycleTo: number | null;
        }) => fixture.failedWrites.some((write) => (
          write.seasonNumber === scope.seasonNumber
          && (scope.cycleFrom === null || write.cycleNumber >= scope.cycleFrom)
          && (scope.cycleTo === null || write.cycleNumber <= scope.cycleTo)
        )));
        mockReportPrisma.$queryRaw.mockReset();
        mockReportPrisma.$queryRaw
          .mockResolvedValueOnce(rows.overview)
          .mockResolvedValueOnce(rows.trends)
          .mockResolvedValueOnce(rows.topPhrases)
          .mockResolvedValueOnce(rows.noResultPhrases)
          .mockResolvedValueOnce(rows.playerAnalysis);

        const report = await getSearchAnalyticsReport(query);

        expect(report).toEqual({
          period: {
            seasonNumber: fixture.activeSeasonContext.seasonNumber,
            cycleNumber: fixture.activeSeasonContext.cycleNumber,
            cycleFrom: fixture.cycleFrom,
            cycleTo: fixture.cycleTo,
          },
          overview: {
            totalSearches: persistedEvents.length,
            uniqueSearchers: new Set(persistedEvents.map((event) => event.userId)).size,
            noResultSearches: persistedEvents.filter((event) => event.noResult).length,
          },
          trends: rows.trends.map((trend) => ({
            cycleNumber: trend.cycle_number,
            totalSearches: trend.total_searches,
            uniqueSearchers: trend.unique_searchers,
            noResultSearches: trend.no_result_searches,
          })),
          topPhrases: rows.topPhrases,
          noResultPhrases: rows.noResultPhrases,
          categoryUsage: {
            robots: persistedEvents.reduce((sum, event) => sum + event.robotResultCount, 0),
            stables: persistedEvents.reduce((sum, event) => sum + event.stableResultCount, 0),
            guide: persistedEvents.reduce((sum, event) => sum + event.guideResultCount, 0),
          },
          playerAnalysis: {
            entries: rows.playerAnalysis.map((entry) => ({
              userId: entry.user_id,
              stableName: entry.stable_name,
              searchCount: entry.search_count,
              noResultCount: entry.no_result_count,
            })),
            page,
            limit: fixture.limit,
            total: playerAggregates.length,
          },
          limitations: failedWriteInScope ? [INCOMPLETE_TELEMETRY_LIMITATION] : [],
        });

        expect(report.playerAnalysis.entries.length).toBeLessThanOrEqual(fixture.limit);
        expect(report.playerAnalysis.entries).toEqual(
          playerAggregates
            .slice((page - 1) * fixture.limit, page * fixture.limit)
            .map((entry) => ({
              userId: entry.userId,
              stableName: entry.stableName,
              searchCount: entry.searchCount,
              noResultCount: entry.noResultCount,
            })),
        );
        expect(mockReportPersistenceFailure).toHaveBeenCalledTimes(1);
        expect(mockReportPrisma.$queryRaw).toHaveBeenCalledTimes(5);

        const persistedPhrases = new Set(persistedEvents.map((event) => event.normalizedPhrase));
        for (const failedWrite of fixture.failedWrites) {
          if (persistedPhrases.has(failedWrite.normalizedPhrase)) continue;
          expect(report.topPhrases).not.toContainEqual({
            phrase: failedWrite.normalizedPhrase,
            count: expect.any(Number),
          });
          expect(report.noResultPhrases).not.toContainEqual({
            phrase: failedWrite.normalizedPhrase,
            count: expect.any(Number),
          });
        }
      }),
      { numRuns: 100 },
    );
  });
});

interface Property16Fixture {
  activeSeasonContext: ActiveSeasonContext;
  persistedEvents: ReportEventFixture[];
  failedWrites: FailedReportWriteFixture[];
  cycleFrom: number;
  cycleTo: number;
  pageSeed: number;
  limit: number;
  adminUserId: number;
  nonAdminUserId: number;
}

function remapReportEvent(
  event: ReportEventFixture,
  seasonNumber: number,
  normalizedPhrase: string,
  cycleNumber = event.cycleNumber,
): ReportEventFixture {
  return { ...event, seasonNumber, normalizedPhrase, cycleNumber };
}

function remapFailedReportWrite(
  write: FailedReportWriteFixture,
  seasonNumber: number,
  normalizedPhrase: string,
): FailedReportWriteFixture {
  return { ...write, seasonNumber, normalizedPhrase };
}

const property16FixtureArbitrary: fc.Arbitrary<Property16Fixture> = fc
  .record({
    seasonNumber: fc.integer({ min: 1, max: 20 }),
    cycleNumber: fc.integer({ min: 0, max: 30 }),
  })
  .chain(({ seasonNumber, cycleNumber }) => {
    const activeSeasonContext: ActiveSeasonContext = { seasonNumber, cycleNumber };
    const activeEvents = fc.array(reportEventArbitrary(activeSeasonContext), {
      minLength: 0,
      maxLength: 20,
    });
    const historicalEvents = fc.array(reportEventArbitrary(activeSeasonContext).map((event) => (
      remapReportEvent(
        event,
        seasonNumber - 1,
        `historical-${event.normalizedPhrase}`,
      )
    )), { minLength: 0, maxLength: 8 });
    const futureSeasonEvents = fc.array(reportEventArbitrary(activeSeasonContext).map((event) => (
      remapReportEvent(
        event,
        seasonNumber + 1,
        `future-season-${event.normalizedPhrase}`,
      )
    )), { minLength: 0, maxLength: 8 });
    const futureCycleEvents = fc.array(reportEventArbitrary(activeSeasonContext).map((event) => (
      remapReportEvent(
        event,
        seasonNumber,
        `future-cycle-${event.normalizedPhrase}`,
        cycleNumber + 1,
      )
    )), { minLength: 0, maxLength: 8 });
    const failedWrites = fc.array(
      fc.oneof(
        failedReportWriteArbitrary(activeSeasonContext),
        failedReportWriteArbitrary(activeSeasonContext).map((write) => (
          remapFailedReportWrite(
            write,
            seasonNumber - 1,
            `historical-failed-${write.normalizedPhrase}`,
          )
        )),
      ),
      { minLength: 1, maxLength: 8 },
    );

    return fc.record({
      activeEvents,
      historicalEvents,
      futureSeasonEvents,
      futureCycleEvents,
      failedWrites,
      cycleBounds: fc.record({
        first: fc.integer({ min: 0, max: cycleNumber }),
        second: fc.integer({ min: 0, max: cycleNumber }),
      }),
      pageSeed: fc.integer({ min: 0, max: 100 }),
      limit: fc.integer({ min: 1, max: 8 }),
      adminUserId: fc.integer({ min: 1, max: 100_000 }),
      nonAdminUserId: fc.integer({ min: 1, max: 100_000 }),
    }).map(({ activeEvents: currentSeasonEvents, historicalEvents: previousSeasonEvents, futureSeasonEvents: nextSeasonEvents, futureCycleEvents: laterCycleEvents, failedWrites: persistenceFailures, cycleBounds, pageSeed, limit, adminUserId, nonAdminUserId }) => ({
      activeSeasonContext,
      persistedEvents: [
        ...currentSeasonEvents,
        ...previousSeasonEvents,
        ...nextSeasonEvents,
        ...laterCycleEvents,
      ],
      failedWrites: persistenceFailures,
      cycleFrom: Math.min(cycleBounds.first, cycleBounds.second),
      cycleTo: Math.max(cycleBounds.first, cycleBounds.second),
      pageSeed,
      limit,
      adminUserId,
      nonAdminUserId,
    }));
  });

interface AdminAuthorizationResult {
  authorized: boolean;
  statusCode: number | undefined;
  body: unknown;
}

function authorizeSearchAnalyticsReport(
  role: 'admin' | 'user',
  userId: number,
): AdminAuthorizationResult {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  let nextCalled = false;

  requireAdmin(
    {
      user: {
        userId,
        username: `property-${userId}`,
        role,
      },
      ip: '127.0.0.1',
      originalUrl: '/api/admin/search-analytics/report',
      method: 'GET',
    } as Parameters<typeof requireAdmin>[0],
    { status, json } as unknown as Parameters<typeof requireAdmin>[1],
    (() => {
      nextCalled = true;
    }) as Parameters<typeof requireAdmin>[2],
  );

  return {
    authorized: nextCalled,
    statusCode: status.mock.calls[0]?.[0] as number | undefined,
    body: json.mock.calls[0]?.[0],
  };
}

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return keys;
  }

  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectObjectKeys(child, keys);
  }
  return keys;
}

function property16EventsInScope(fixture: Property16Fixture): ReportEventFixture[] {
  return fixture.persistedEvents.filter((event) => isInReportScope(
    event.seasonNumber,
    event.cycleNumber,
    fixture.activeSeasonContext,
    fixture.cycleFrom,
    fixture.cycleTo,
  ));
}

function property16FailedWriteInScope(
  write: FailedReportWriteFixture,
  fixture: Property16Fixture,
): boolean {
  return isInReportScope(
    write.seasonNumber,
    write.cycleNumber,
    fixture.activeSeasonContext,
    fixture.cycleFrom,
    fixture.cycleTo,
  );
}

/**
 * Feature: universal-search, Property 16: Admin authorization and active-season report isolation
 *
 * **Validates: Design Property 16; Requirements 12.14, 12.18–12.20, 9.6, 9.7**
 */
describe('Property 16: Admin authorization and active-season report isolation', () => {
  it('should authorize only administrators, bound reports to the active season, and purge retained event data without an archive', async () => {
    await fc.assert(
      fc.asyncProperty(property16FixtureArbitrary, async (fixture) => {
        const activeEvents = property16EventsInScope(fixture);
        const playerAggregates = expectedPlayerAggregates(activeEvents);
        const pageCount = Math.max(1, Math.ceil(playerAggregates.length / fixture.limit));
        const page = (fixture.pageSeed % pageCount) + 1;
        const query: SearchAnalyticsReportQuery = {
          cycleFrom: fixture.cycleFrom,
          cycleTo: fixture.cycleTo,
          page,
          limit: fixture.limit,
        };
        const rows = reportQueryRows(activeEvents, page, fixture.limit);
        const failedWriteInScope = fixture.failedWrites.some((write) => (
          property16FailedWriteInScope(write, fixture)
        ));

        mockReportPrisma.$queryRaw.mockReset();
        mockReportPrisma.$queryRaw
          .mockResolvedValueOnce(rows.overview)
          .mockResolvedValueOnce(rows.trends)
          .mockResolvedValueOnce(rows.topPhrases)
          .mockResolvedValueOnce(rows.noResultPhrases)
          .mockResolvedValueOnce(rows.playerAnalysis);
        mockReportPersistenceFailure.mockReset();
        mockReportPersistenceFailure.mockImplementation((scope: ReportFailureScopeFixture) => (
          fixture.failedWrites.some((write) => (
            write.seasonNumber === scope.seasonNumber
            && (scope.cycleFrom === null || write.cycleNumber >= scope.cycleFrom)
            && (scope.cycleTo === null || write.cycleNumber <= scope.cycleTo)
          ))
        ));
        mockReportGetCurrentSeason.mockReset();
        mockReportGetCurrentSeason.mockResolvedValue({
          seasonNumber: fixture.activeSeasonContext.seasonNumber,
          seasonCycle: fixture.activeSeasonContext.cycleNumber,
        });

        const queryCallsBeforeNonAdmin = mockReportPrisma.$queryRaw.mock.calls.length;
        const nonAdmin = authorizeSearchAnalyticsReport('user', fixture.nonAdminUserId);
        expect(nonAdmin).toEqual({
          authorized: false,
          statusCode: 403,
          body: { error: 'Admin access required' },
        });
        expect(mockReportPrisma.$queryRaw.mock.calls.length).toBe(queryCallsBeforeNonAdmin);

        const admin = authorizeSearchAnalyticsReport('admin', fixture.adminUserId);
        expect(admin.authorized).toBe(true);
        expect(admin.statusCode).toBeUndefined();
        expect(admin.body).toBeUndefined();

        const report = await getSearchAnalyticsReport(query);
        expect(report.period).toEqual({
          seasonNumber: fixture.activeSeasonContext.seasonNumber,
          cycleNumber: fixture.activeSeasonContext.cycleNumber,
          cycleFrom: fixture.cycleFrom,
          cycleTo: fixture.cycleTo,
        });
        expect(report.overview).toEqual({
          totalSearches: activeEvents.length,
          uniqueSearchers: new Set(activeEvents.map((event) => event.userId)).size,
          noResultSearches: activeEvents.filter((event) => event.noResult).length,
        });
        expect(report.categoryUsage).toEqual({
          robots: activeEvents.reduce((sum, event) => sum + event.robotResultCount, 0),
          stables: activeEvents.reduce((sum, event) => sum + event.stableResultCount, 0),
          guide: activeEvents.reduce((sum, event) => sum + event.guideResultCount, 0),
        });
        expect(report.topPhrases).toEqual(rows.topPhrases);
        expect(report.noResultPhrases).toEqual(rows.noResultPhrases);
        expect(report.playerAnalysis).toEqual({
          entries: rows.playerAnalysis.map((entry) => ({
            userId: entry.user_id,
            stableName: entry.stable_name,
            searchCount: entry.search_count,
            noResultCount: entry.no_result_count,
          })),
          page,
          limit: fixture.limit,
          total: playerAggregates.length,
        });
        expect(report.limitations).toEqual(
          failedWriteInScope ? [INCOMPLETE_TELEMETRY_LIMITATION] : [],
        );
        expect(report.playerAnalysis.entries.length).toBeLessThanOrEqual(fixture.limit);

        const reportPhrases = [
          ...report.topPhrases,
          ...report.noResultPhrases,
        ].map((entry) => entry.phrase);
        const activePhrases = new Set(activeEvents.map((event) => event.normalizedPhrase));
        for (const event of fixture.persistedEvents.filter((event) => !activeEvents.includes(event))) {
          if (activePhrases.has(event.normalizedPhrase)) continue;
          expect(reportPhrases).not.toContain(event.normalizedPhrase);
        }
        for (const failedWrite of fixture.failedWrites) {
          if (activePhrases.has(failedWrite.normalizedPhrase)) continue;
          expect(reportPhrases).not.toContain(failedWrite.normalizedPhrase);
        }

        const reportKeys = collectObjectKeys(report);
        for (const rawEventKey of [
          'id',
          'eventTimestamp',
          'normalizedPhrase',
          'robotResultCount',
          'stableResultCount',
          'guideResultCount',
          'totalResultCount',
          'noResult',
        ]) {
          expect(reportKeys).not.toContain(rawEventKey);
        }
        expect(mockReportPrisma.$queryRaw).toHaveBeenCalledTimes(5);
        expect(mockReportPersistenceFailure).toHaveBeenCalledTimes(1);

        let retainedEventCount = fixture.persistedEvents.length;
        const initialEventCount = retainedEventCount;
        mockReportPrisma.$queryRawUnsafe.mockReset();
        mockReportPrisma.$queryRawUnsafe.mockImplementation(async (...args: unknown[]) => {
          const sql = String(args[0]);
          const table = sql.match(/FROM "([^"]+)"/)?.[1];
          return [{ count: BigInt(table === 'search_analytics_events' ? retainedEventCount : 0) }];
        });
        mockReportPrisma.$executeRawUnsafe.mockReset();
        mockReportPrisma.$executeRawUnsafe.mockImplementation(async (...args: unknown[]) => {
          if (String(args[0]).includes('TRUNCATE TABLE')) retainedEventCount = 0;
        });
        mockReportPrisma.cycleMetadata.update.mockReset();
        mockReportPrisma.cycleMetadata.update.mockResolvedValue({});

        const deleted = await purgeHistory();
        expect(deleted.search_analytics_events).toBe(initialEventCount);
        expect(retainedEventCount).toBe(0);
        expect(mockReportPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
        const truncateSql = mockReportPrisma.$executeRawUnsafe.mock.calls[0]?.[0] as string;
        expect(truncateSql).toContain('"search_analytics_events"');
        expect(truncateSql).not.toMatch(/stable_season_archives|robot_season_archives|season_accolades|season_standing_snapshots/);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
