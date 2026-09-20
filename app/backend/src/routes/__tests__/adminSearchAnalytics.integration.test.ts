/**
 * PostgreSQL integration coverage for Search_Analytics_Store and the admin
 * Search_Analytics_Report resource.
 *
 * This suite deliberately uses the real Prisma singleton and real HTTP route
 * middleware. It is database-dependent and belongs exclusively to the
 * Integration_Tier (the tier registry is maintained by the adjacent tier task).
 *
 * Requirements: 9.2, 9.7, 12.1–12.20
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import prisma from '../../lib/prisma';
import { errorHandler } from '../../middleware/errorHandler';
import { authenticateToken } from '../../middleware/auth';
import { requestLogger } from '../../middleware/requestLogger';
import { createUserEconomicLimiter } from '../../middleware/userRateLimiter';
import adminAnalyticsRoutes from '../adminAnalytics';
import searchRoutes from '../search';
import logger from '../../config/logger';
import guideService from '../../services/common/guide-service';
import { securityMonitor } from '../../services/security/securityMonitor';
import {
  getCurrentSeason,
  invalidateSeasonCache,
} from '../../services/season/seasonService';
import {
  clearSearchAnalyticsPersistenceFailures,
  searchAnalyticsStore,
} from '../../services/search/searchAnalyticsStore';

interface SearchFixture {
  userId: number;
  username: string;
  token: string;
  stableName: string;
  robotName: string;
}

interface ActiveFixtureContext {
  seasonNumber: number;
  cycleNumber: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
let fixtureSequence = 0;

/**
 * Build the smallest app that still mirrors the production route boundary:
 * request logging, authentication before the per-user limiter, the route's
 * own validation/authentication, the admin report route, and the error path.
 */
function buildApp(userRateLimitMax: number): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);
  app.use(
    '/api/search',
    authenticateToken,
    createUserEconomicLimiter({ userEconomicRateLimitMax: userRateLimitMax }),
  );
  app.use('/api/search', searchRoutes);
  app.use('/api/admin', adminAnalyticsRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp(1_000);
const rateLimitedApp = buildApp(0);

async function createFixture(role: 'user' | 'admin'): Promise<SearchFixture> {
  fixtureSequence += 1;
  const suffix = `${Date.now()}${fixtureSequence}`;
  const username = `search_it_${role}_${suffix}`;
  const stableName = `Stable${suffix}`;
  const robotName = `Robot${suffix}`;

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: 'integration-test-hash',
      role,
      stableName,
      hasCompletedOnboarding: true,
    },
    select: { id: true, username: true },
  });

  await prisma.robot.create({
    data: {
      userId: user.id,
      name: robotName,
      currentHP: 100,
      maxHP: 100,
      currentShield: 10,
      maxShield: 10,
    },
  });

  return {
    userId: user.id,
    username: user.username,
    token: jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role,
        tokenVersion: 0,
      },
      JWT_SECRET,
    ),
    stableName,
    robotName,
  };
}

async function deleteFixture(fixture: SearchFixture): Promise<void> {
  await prisma.searchAnalyticsEvent.deleteMany({ where: { userId: fixture.userId } });
  await prisma.robot.deleteMany({ where: { userId: fixture.userId } });
  await prisma.user.delete({ where: { id: fixture.userId } }).catch(() => undefined);
}

async function countFixtureEvents(userId: number): Promise<number> {
  return prisma.searchAnalyticsEvent.count({ where: { userId } });
}

function withToken(path: string, fixture: SearchFixture): request.Test {
  return request(app).get(path).set('Authorization', `Bearer ${fixture.token}`);
}

async function executeSearch(
  fixture: SearchFixture,
  query: string,
  targetApp: express.Express = app,
): Promise<request.Response> {
  return request(targetApp)
    .get('/api/search')
    .query({ q: query })
    .set('Authorization', `Bearer ${fixture.token}`);
}

function eventCounts(response: request.Response): {
  robots: number;
  stables: number;
  guide: number;
  total: number;
} {
  const robots = response.body.robots.length as number;
  const stables = response.body.stables.length as number;
  const guide = response.body.guide.length as number;
  return { robots, stables, guide, total: robots + stables + guide };
}

async function insertReportEvent(
  context: ActiveFixtureContext,
  fixture: SearchFixture,
  normalizedPhrase: string,
  counts: { robots: number; stables: number; guide: number },
  seasonNumber = context.seasonNumber,
): Promise<void> {
  const total = counts.robots + counts.stables + counts.guide;
  await prisma.searchAnalyticsEvent.create({
    data: {
      seasonNumber,
      cycleNumber: context.cycleNumber,
      userId: fixture.userId,
      eventTimestamp: new Date(),
      normalizedPhrase,
      robotResultCount: counts.robots,
      stableResultCount: counts.stables,
      guideResultCount: counts.guide,
      totalResultCount: total,
      noResult: total === 0,
    },
  });
}

describe('Admin Search Analytics route integration', () => {
  let owner: SearchFixture;
  let otherPlayer: SearchFixture;
  let admin: SearchFixture;
  let activeContext: ActiveFixtureContext;

  beforeAll(async () => {
    await prisma.$connect();
    invalidateSeasonCache();
    const season = await getCurrentSeason();
    activeContext = {
      seasonNumber: season.seasonNumber,
      cycleNumber: season.seasonCycle,
    };
    owner = await createFixture('user');
    otherPlayer = await createFixture('user');
    admin = await createFixture('admin');
  });

  beforeEach(async () => {
    await prisma.searchAnalyticsEvent.deleteMany({
      where: { userId: { in: [owner.userId, otherPlayer.userId, admin.userId] } },
    });
    await clearSearchAnalyticsPersistenceFailures();
  });

  afterAll(async () => {
    await clearSearchAnalyticsPersistenceFailures();
    await deleteFixture(owner);
    await deleteFixture(otherPlayer);
    await deleteFixture(admin);
  });

  describe('Search_Analytics_Store eligibility and server-owned fields', () => {
    it('should make exactly one write attempt and persist exactly one event for a completed search, including zero results', async () => {
      const storeSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const query = `  ${owner.robotName}  `;
      const before = new Date();

      try {
        const result = await executeSearch(owner, query);
        expect(result.status).toBe(200);
        expect(result.body).toEqual(
          expect.objectContaining({ robots: expect.any(Array), stables: expect.any(Array), guide: expect.any(Array) }),
        );
        expect(storeSpy).toHaveBeenCalledTimes(1);

        const counts = eventCounts(result);
        const event = await prisma.searchAnalyticsEvent.findFirst({
          where: { userId: owner.userId, normalizedPhrase: owner.robotName },
        });
        expect(event).not.toBeNull();
        expect(event).toMatchObject({
          userId: owner.userId,
          seasonNumber: activeContext.seasonNumber,
          cycleNumber: activeContext.cycleNumber,
          normalizedPhrase: owner.robotName,
          robotResultCount: counts.robots,
          stableResultCount: counts.stables,
          guideResultCount: counts.guide,
          totalResultCount: counts.total,
          noResult: counts.total === 0,
        });
        expect(event!.eventTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(event!.eventTimestamp.getTime()).toBeLessThanOrEqual(Date.now());
        expect(await countFixtureEvents(owner.userId)).toBe(1);

        const zeroQuery = `__analytics_zero_${Date.now()}_${fixtureSequence}__`;
        const zeroResult = await executeSearch(owner, zeroQuery);
        expect(zeroResult.status).toBe(200);
        expect(zeroResult.body).toEqual({ robots: [], stables: [], guide: [] });
        expect(storeSpy).toHaveBeenCalledTimes(2);

        const zeroEvent = await prisma.searchAnalyticsEvent.findFirst({
          where: { userId: owner.userId, normalizedPhrase: zeroQuery },
        });
        expect(zeroEvent).toMatchObject({
          seasonNumber: activeContext.seasonNumber,
          cycleNumber: activeContext.cycleNumber,
          normalizedPhrase: zeroQuery,
          robotResultCount: 0,
          stableResultCount: 0,
          guideResultCount: 0,
          totalResultCount: 0,
          noResult: true,
        });
        expect(await countFixtureEvents(owner.userId)).toBe(2);
      } finally {
        storeSpy.mockRestore();
      }
    });

    it('should leave no write attempt or event for short, malformed, overlength, unauthenticated, rate-limited, or source-failed requests', async () => {
      const storeSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const initialCount = await countFixtureEvents(owner.userId);
      const sourceQuery = `source_failure_${Date.now()}_${fixtureSequence}`;
      const guideIndexSpy = jest
        .spyOn(guideService, 'getSearchIndex')
        .mockImplementation(() => {
          throw new Error(`database failure containing ${sourceQuery}`);
        });
      const rateLimitViolationSpy = jest.spyOn(securityMonitor, 'trackRateLimitViolation');

      try {
        const missing = await withToken('/api/search', owner);
        const unknown = await withToken('/api/search?q=valid&unexpected=field', owner);
        const repeated = await request(app)
          .get('/api/search')
          .query({ q: ['first', 'second'] })
          .set('Authorization', `Bearer ${owner.token}`);
        const overlength = await executeSearch(owner, 'x'.repeat(101));
        const short = await executeSearch(owner, 'a');
        const unauthenticated = await request(app)
          .get('/api/search')
          .query({ q: `unauthenticated_${Date.now()}_${fixtureSequence}` });
        const rateLimited = await executeSearch(
          owner,
          `rate_limited_${Date.now()}_${fixtureSequence}`,
          rateLimitedApp,
        );
        const sourceFailed = await executeSearch(owner, sourceQuery);

        expect(missing.status).toBe(400);
        expect(unknown.status).toBe(400);
        expect(repeated.status).toBe(400);
        expect(overlength.status).toBe(400);
        expect(short.status).toBe(200);
        expect(short.body).toEqual({ robots: [], stables: [], guide: [] });
        expect(unauthenticated.status).toBe(401);
        expect(rateLimited.status).toBe(429);
        expect(sourceFailed.status).toBe(500);
        expect(storeSpy).not.toHaveBeenCalled();
        expect(await countFixtureEvents(owner.userId)).toBe(initialCount);

        expect(rateLimitViolationSpy).toHaveBeenCalled();
        const rateLimitDiagnostics = JSON.stringify(rateLimitViolationSpy.mock.calls);
        expect(rateLimitDiagnostics).toContain('/api/search');
        expect(rateLimitDiagnostics).not.toContain('rate_limited_');
      } finally {
        guideIndexSpy.mockRestore();
        rateLimitViolationSpy.mockRestore();
        storeSpy.mockRestore();
      }
    });

    it('should make no analytics attempt for history, selection, category, or report-only operations', async () => {
      const storeSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const initialCount = await countFixtureEvents(owner.userId);

      try {
        const history = await request(app)
          .get('/api/search/history')
          .set('Authorization', `Bearer ${owner.token}`);
        const selection = await request(app)
          .post('/api/search/selection')
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ category: 'robots', resultId: 1 });
        const category = await request(app)
          .post('/api/search/category')
          .set('Authorization', `Bearer ${owner.token}`)
          .send({ category: 'robots' });
        const report = await request(app)
          .get('/api/admin/search-analytics/report')
          .set('Authorization', `Bearer ${admin.token}`);

        expect(history.status).toBe(404);
        expect(selection.status).toBe(404);
        expect(category.status).toBe(404);
        expect(report.status).toBe(200);
        expect(storeSpy).not.toHaveBeenCalled();
        expect(await countFixtureEvents(owner.userId)).toBe(initialCount);
      } finally {
        storeSpy.mockRestore();
      }
    });
  });

  describe('Telemetry_Fail_Open and phrase isolation', () => {
    it('should preserve the successful Search_Response, avoid a row/retry, and expose only a typed limitation when persistence fails', async () => {
      const query = `__response_isolation_${Date.now()}_${fixtureSequence}__`;
      const successful = await executeSearch(owner, query);
      expect(successful.status).toBe(200);
      expect(await prisma.searchAnalyticsEvent.count({ where: { userId: owner.userId, normalizedPhrase: query } })).toBe(1);
      await prisma.searchAnalyticsEvent.deleteMany({ where: { userId: owner.userId, normalizedPhrase: query } });

      const createSpy = jest
        .spyOn(prisma.searchAnalyticsEvent, 'create')
        .mockRejectedValue(new Error(`persistence failure ${query}`));
      const storeSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockClear();
      const loggerDebugSpy = jest.spyOn(logger, 'debug').mockClear();

      try {
        const failedPersistence = await executeSearch(owner, query);

        expect(failedPersistence.status).toBe(200);
        expect(failedPersistence.body).toEqual(successful.body);
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(storeSpy).toHaveBeenCalledTimes(1);
        expect(await prisma.searchAnalyticsEvent.count({ where: { userId: owner.userId, normalizedPhrase: query } })).toBe(0);

        const report = await request(app)
          .get('/api/admin/search-analytics/report')
          .set('Authorization', `Bearer ${admin.token}`);
        expect(report.status).toBe(200);
        expect(report.body.limitations).toEqual([
          expect.objectContaining({
            code: 'analyticsDataIncomplete',
            message: expect.any(String),
          }),
        ]);

        const safeDiagnostics = JSON.stringify([
          ...loggerWarnSpy.mock.calls,
          ...loggerDebugSpy.mock.calls,
        ]);
        expect(safeDiagnostics).not.toContain(query);
        expect(JSON.stringify(failedPersistence.body)).not.toContain(query);
      } finally {
        createSpy.mockRestore();
        storeSpy.mockRestore();
        loggerWarnSpy.mockRestore();
        loggerDebugSpy.mockRestore();
        await clearSearchAnalyticsPersistenceFailures();
      }
    });

    it('should keep raw phrases out of player responses and ordinary request/error/rate-limit diagnostics while exposing them to an authorized report', async () => {
      const phrase = `__phrase_redaction_${Date.now()}_${fixtureSequence}__`;
      const loggerDebugSpy = jest.spyOn(logger, 'debug').mockClear();
      const loggerWarnSpy = jest.spyOn(logger, 'warn').mockClear();

      try {
        const response = await executeSearch(owner, phrase);
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).not.toContain(phrase);

        const overlength = await executeSearch(owner, `${phrase}${'x'.repeat(101)}`);
        expect(overlength.status).toBe(400);

        const diagnostics = JSON.stringify([
          ...loggerDebugSpy.mock.calls,
          ...loggerWarnSpy.mock.calls,
        ]);
        expect(diagnostics).not.toContain(phrase);
        expect(diagnostics).toContain('/api/search');

        const report = await request(app)
          .get('/api/admin/search-analytics/report')
          .set('Authorization', `Bearer ${admin.token}`);
        expect(report.status).toBe(200);
        expect(report.body.topPhrases).toEqual(
          expect.arrayContaining([expect.objectContaining({ phrase, count: 1 })]),
        );
      } finally {
        loggerDebugSpy.mockRestore();
        loggerWarnSpy.mockRestore();
      }
    });
  });

  describe('Admin_Search_Analytics_Resource authorization and report aggregates', () => {
    it('should preserve admin authorization and return no report data to unauthenticated or non-admin players', async () => {
      const unauthenticated = await request(app).get('/api/admin/search-analytics/report');
      const nonAdmin = await request(app)
        .get('/api/admin/search-analytics/report')
        .set('Authorization', `Bearer ${owner.token}`);
      const authorized = await request(app)
        .get('/api/admin/search-analytics/report')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(unauthenticated.status).toBe(401);
      expect(unauthenticated.body).toEqual({ error: 'Access token required' });
      expect(nonAdmin.status).toBe(403);
      expect(nonAdmin.body).toEqual({ error: 'Admin access required' });
      expect(authorized.status).toBe(200);
      expect(authorized.body).toEqual(
        expect.objectContaining({
          period: expect.any(Object),
          overview: expect.any(Object),
          trends: expect.any(Array),
          topPhrases: expect.any(Array),
          noResultPhrases: expect.any(Array),
          categoryUsage: expect.any(Object),
          playerAnalysis: expect.any(Object),
          limitations: expect.any(Array),
        }),
      );
    });

    it('should aggregate active-season totals, top/no-result phrases, category usage, trends, and deterministic bounded pagination', async () => {
      const before = await request(app)
        .get('/api/admin/search-analytics/report')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(before.status).toBe(200);

      const topPhrase = owner.robotName;
      const noResultPhrase = `__report_no_result_${Date.now()}_${fixtureSequence}__`;
      const stablePhrase = owner.stableName;

      const topOwner = await executeSearch(owner, topPhrase);
      const topOther = await executeSearch(otherPlayer, topPhrase);
      const stableResult = await executeSearch(owner, stablePhrase);
      const guideResult = await executeSearch(owner, 'yield');
      const noResult = await executeSearch(owner, noResultPhrase);

      for (const response of [topOwner, topOther, stableResult, guideResult, noResult]) {
        expect(response.status).toBe(200);
      }
      expect(eventCounts(topOwner).robots).toBeGreaterThan(0);
      expect(eventCounts(topOther).robots).toBeGreaterThan(0);
      expect(eventCounts(stableResult).stables).toBeGreaterThan(0);
      expect(eventCounts(guideResult).guide).toBeGreaterThan(0);
      expect(noResult.body).toEqual({ robots: [], stables: [], guide: [] });

      // These rows are real database rows but belong outside the active season.
      // They prove the server-owned report scope cannot be broadened by a client
      // query or by stale operational history, and no archive table is involved.
      const historicalPhrase = `__historical_${Date.now()}_${fixtureSequence}__`;
      const futurePhrase = `__future_${Date.now()}_${fixtureSequence}__`;
      await insertReportEvent(activeContext, owner, historicalPhrase, { robots: 9, stables: 9, guide: 9 }, activeContext.seasonNumber - 1);
      await insertReportEvent(activeContext, owner, futurePhrase, { robots: 9, stables: 9, guide: 9 }, activeContext.seasonNumber + 1);

      const after = await request(app)
        .get('/api/admin/search-analytics/report')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(after.status).toBe(200);

      expect(after.body.period).toMatchObject({
        seasonNumber: activeContext.seasonNumber,
        cycleNumber: activeContext.cycleNumber,
      });
      expect(after.body.overview.totalSearches - before.body.overview.totalSearches).toBe(5);
      expect(after.body.overview.uniqueSearchers - before.body.overview.uniqueSearchers).toBe(2);
      expect(after.body.overview.noResultSearches - before.body.overview.noResultSearches).toBe(1);
      expect(after.body.categoryUsage.robots - before.body.categoryUsage.robots).toBe(
        eventCounts(topOwner).robots + eventCounts(topOther).robots,
      );
      expect(after.body.categoryUsage.stables - before.body.categoryUsage.stables).toBe(
        eventCounts(stableResult).stables,
      );
      expect(after.body.categoryUsage.guide - before.body.categoryUsage.guide).toBe(
        eventCounts(guideResult).guide,
      );

      expect(after.body.topPhrases).toEqual(
        expect.arrayContaining([expect.objectContaining({ phrase: topPhrase, count: 2 })]),
      );
      expect(after.body.noResultPhrases).toEqual(
        expect.arrayContaining([expect.objectContaining({ phrase: noResultPhrase, count: 1 })]),
      );
      expect(after.body.topPhrases).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ phrase: historicalPhrase }),
          expect.objectContaining({ phrase: futurePhrase }),
        ]),
      );
      expect(after.body.noResultPhrases).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ phrase: historicalPhrase }),
          expect.objectContaining({ phrase: futurePhrase }),
        ]),
      );

      const currentTrend = after.body.trends.find(
        (trend: { cycleNumber: number }) => trend.cycleNumber === activeContext.cycleNumber,
      );
      expect(currentTrend).toEqual(
        expect.objectContaining({
          cycleNumber: activeContext.cycleNumber,
          totalSearches: expect.any(Number),
          uniqueSearchers: expect.any(Number),
          noResultSearches: expect.any(Number),
        }),
      );
      expect(currentTrend.totalSearches).toBeGreaterThanOrEqual(5);
      expect(currentTrend.noResultSearches).toBeGreaterThanOrEqual(1);

      const pageOne = await request(app)
        .get('/api/admin/search-analytics/report')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${admin.token}`);
      const pageTwo = await request(app)
        .get('/api/admin/search-analytics/report')
        .query({ page: 2, limit: 1 })
        .set('Authorization', `Bearer ${admin.token}`);

      expect(pageOne.status).toBe(200);
      expect(pageTwo.status).toBe(200);
      expect(pageOne.body.playerAnalysis).toMatchObject({ page: 1, limit: 1 });
      expect(pageTwo.body.playerAnalysis).toMatchObject({ page: 2, limit: 1 });
      expect(pageOne.body.playerAnalysis.entries.length).toBeLessThanOrEqual(1);
      expect(pageTwo.body.playerAnalysis.entries.length).toBeLessThanOrEqual(1);
      expect(pageOne.body.playerAnalysis.total).toBeGreaterThanOrEqual(2);
      expect(pageTwo.body.playerAnalysis.total).toBe(pageOne.body.playerAnalysis.total);
      expect(pageOne.body.playerAnalysis.entries[0].userId).not.toBe(
        pageTwo.body.playerAnalysis.entries[0].userId,
      );
      expect(pageOne.body.playerAnalysis.entries[0]).toEqual(
        expect.objectContaining({
          userId: expect.any(Number),
          searchCount: expect.any(Number),
          noResultCount: expect.any(Number),
        }),
      );
    });

    it('should reject invalid or historical cycle report requests without creating an analytics event', async () => {
      const storeSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const before = await countFixtureEvents(owner.userId);

      try {
        const reversed = await request(app)
          .get('/api/admin/search-analytics/report')
          .query({ cycleFrom: 2, cycleTo: 1 })
          .set('Authorization', `Bearer ${admin.token}`);
        const future = await request(app)
          .get('/api/admin/search-analytics/report')
          .query({ cycleFrom: activeContext.cycleNumber + 1 })
          .set('Authorization', `Bearer ${admin.token}`);
        const overLimit = await request(app)
          .get('/api/admin/search-analytics/report')
          .query({ limit: 101 })
          .set('Authorization', `Bearer ${admin.token}`);

        expect(reversed.status).toBe(400);
        expect(future.status).toBe(400);
        expect(overLimit.status).toBe(400);
        expect(storeSpy).not.toHaveBeenCalled();
        expect(await countFixtureEvents(owner.userId)).toBe(before);
      } finally {
        storeSpy.mockRestore();
      }
    });
  });

  describe('Season_Rollover active-history purge', () => {
    it('should delete Search_Analytics_Event rows during the purge stage without creating an archive row', async () => {
      const phrase = `__rollover_purge_${Date.now()}_${fixtureSequence}__`;
      await insertReportEvent(activeContext, owner, phrase, { robots: 1, stables: 0, guide: 0 });
      expect(await prisma.searchAnalyticsEvent.count({ where: { userId: owner.userId, normalizedPhrase: phrase } })).toBe(1);

      // The purge stage is destructive for all operational history. Run it in
      // a transaction and roll the transaction back after asserting the real
      // TRUNCATE path, so this suite does not erase data owned by other
      // integration suites in the shared PostgreSQL database.
      const rollback = new Error('rollback search analytics purge assertion');
      try {
        await expect(
          prisma.$transaction(async (tx) => {
            let purgeHistoryInTransaction: (() => Promise<Record<string, number>>) | undefined;

            await jest.isolateModulesAsync(async () => {
              jest.doMock('../../lib/prisma', () => ({
                __esModule: true,
                default: tx,
              }));
              ({ purgeHistory: purgeHistoryInTransaction } = await import('../../services/season/seasonPurgeService'));
            });

            if (!purgeHistoryInTransaction) {
              throw new Error('Failed to load the transaction-scoped season purge service');
            }

            const deleted = await purgeHistoryInTransaction();
            expect(deleted.search_analytics_events).toBeGreaterThanOrEqual(1);
            expect(await tx.searchAnalyticsEvent.count()).toBe(0);
            expect(await tx.stableSeasonArchive.count({ where: { userId: owner.userId } })).toBe(0);
            expect(await tx.robotSeasonArchive.count({ where: { stableArchive: { userId: owner.userId } } })).toBe(0);
            throw rollback;
          }),
        ).rejects.toBe(rollback);
      } finally {
        jest.dontMock('../../lib/prisma');
      }

      expect(await prisma.searchAnalyticsEvent.count({ where: { userId: owner.userId, normalizedPhrase: phrase } })).toBe(1);
      expect(await prisma.stableSeasonArchive.count({ where: { userId: owner.userId } })).toBe(0);
      expect(await prisma.robotSeasonArchive.count({ where: { stableArchive: { userId: owner.userId } } })).toBe(0);
    });

    it('should leave rollover incomplete when the required search analytics purge fails without a cross-season archive', async () => {
      const isolatedSeasonNumber = activeContext.seasonNumber + 10_000 + fixtureSequence;
      const nextSeasonNumber = isolatedSeasonNumber + 1;
      const phrase = `__required_purge_failure_${Date.now()}_${fixtureSequence}__`;
      const purgeError = new Error('required search analytics purge failed');
      const rollback = new Error('rollback failed rollover assertion');

      try {
        await expect(
          prisma.$transaction(async (tx) => {
            await tx.season.create({
              data: {
                seasonNumber: isolatedSeasonNumber,
                phase: 'competitive',
                competitiveCyclesCompleted: 0,
                preparationCyclesCompleted: 0,
                startedAt: new Date(),
              },
            });
            await tx.searchAnalyticsEvent.create({
              data: {
                seasonNumber: isolatedSeasonNumber,
                cycleNumber: 1,
                userId: owner.userId,
                eventTimestamp: new Date(),
                normalizedPhrase: phrase,
                robotResultCount: 0,
                stableResultCount: 0,
                guideResultCount: 0,
                totalResultCount: 0,
                noResult: true,
              },
            });

            const transactionPrisma: typeof tx = new Proxy(tx, {
              get(target, property, receiver) {
                if (property === '$queryRawUnsafe') {
                  return async (query: string, ...values: unknown[]): Promise<unknown> => {
                    if (query.includes('"search_analytics_events"')) {
                      throw purgeError;
                    }
                    const queryRawUnsafe = Reflect.get(target, property, receiver) as unknown as (
                      ...args: unknown[]
                    ) => Promise<unknown>;
                    return queryRawUnsafe.apply(target, [query, ...values]);
                  };
                }
                if (property === '$transaction') {
                  return async (callback: (client: typeof tx) => Promise<unknown>): Promise<unknown> =>
                    callback(transactionPrisma);
                }
                return Reflect.get(target, property, receiver);
              },
            });

            let executeRolloverInTransaction:
              | ((options: { trigger: 'admin'; adminUserId?: number }) => Promise<unknown>)
              | undefined;

            await jest.isolateModulesAsync(async () => {
              jest.doMock('../../lib/prisma', () => ({
                __esModule: true,
                default: transactionPrisma,
              }));
              ({ executeSeasonRollover: executeRolloverInTransaction } = await import(
                '../../services/season/seasonRolloverService'
              ));
            });

            if (!executeRolloverInTransaction) {
              throw new Error('Failed to load the transaction-scoped season rollover service');
            }

            await expect(
              executeRolloverInTransaction({ trigger: 'admin', adminUserId: owner.userId }),
            ).rejects.toBe(purgeError);

            const currentSeason = await tx.season.findUnique({
              where: { seasonNumber: isolatedSeasonNumber },
            });
            expect(currentSeason).toMatchObject({ phase: 'competitive', endedAt: null });
            expect(await tx.season.findUnique({ where: { seasonNumber: nextSeasonNumber } })).toBeNull();
            expect(
              await tx.searchAnalyticsEvent.count({
                where: { seasonNumber: isolatedSeasonNumber, normalizedPhrase: phrase },
              }),
            ).toBe(1);
            expect(await tx.searchAnalyticsEvent.count({ where: { seasonNumber: nextSeasonNumber } })).toBe(0);

            // The canonical archive may exist for the season being rolled over,
            // but no next-season or analytics fallback/archive may be created
            // before the required operational purge has completed.
            expect(
              await tx.stableSeasonArchive.count({ where: { seasonNumber: isolatedSeasonNumber + 1 } }),
            ).toBe(0);
            expect(
              await tx.robotSeasonArchive.count({
                where: { stableArchive: { seasonNumber: isolatedSeasonNumber + 1 } },
              }),
            ).toBe(0);
            expect(
              await tx.seasonStandingSnapshot.count({ where: { seasonNumber: isolatedSeasonNumber + 1 } }),
            ).toBe(0);
            expect(await tx.seasonAccolade.count({ where: { seasonNumber: isolatedSeasonNumber + 1 } })).toBe(0);

            throw rollback;
          }),
        ).rejects.toBe(rollback);
      } finally {
        jest.dontMock('../../lib/prisma');
        invalidateSeasonCache();
      }

      expect(await prisma.season.findUnique({ where: { seasonNumber: isolatedSeasonNumber } })).toBeNull();
      expect(await prisma.season.findUnique({ where: { seasonNumber: nextSeasonNumber } })).toBeNull();
      expect(
        await prisma.searchAnalyticsEvent.count({ where: { normalizedPhrase: phrase } }),
      ).toBe(0);
      expect(await prisma.stableSeasonArchive.count({ where: { seasonNumber: nextSeasonNumber } })).toBe(0);
      expect(
        await prisma.robotSeasonArchive.count({
          where: { stableArchive: { seasonNumber: nextSeasonNumber } },
        }),
      ).toBe(0);
      expect(await prisma.seasonStandingSnapshot.count({ where: { seasonNumber: nextSeasonNumber } })).toBe(0);
      expect(await prisma.seasonAccolade.count({ where: { seasonNumber: nextSeasonNumber } })).toBe(0);
    });
  });
});
