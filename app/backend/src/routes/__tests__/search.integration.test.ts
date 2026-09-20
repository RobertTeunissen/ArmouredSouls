import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Server } from 'node:http';

import guideRoutes from '../guide';
import robotRoutes from '../robots';
import searchRoutes from '../search';
import stableRoutes from '../stables';
import { errorHandler } from '../../middleware/errorHandler';
import { authenticateToken } from '../../middleware/auth';
import { requestLogger } from '../../middleware/requestLogger';
import { createGeneralLimiter } from '../../middleware/rateLimiter';
import { createUserEconomicLimiter } from '../../middleware/userRateLimiter';
import { getConfig } from '../../config/env';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { securityMonitor } from '../../services/security/securityMonitor';
import guideService from '../../services/common/guide-service';
import searchAnalyticsStore from '../../services/search/searchAnalyticsStore';
import type { SearchResponse } from '../../services/search/searchTypes';
import { createTestRobot } from '../../../tests/testHelpers';

/**
 * Integration coverage for the authenticated universal-search boundary.
 *
 * This suite deliberately uses the real Prisma singleton and a listening HTTP
 * server. It exercises the same authentication, request protection, route,
 * destination, and error middleware used by the application, while keeping
 * fixtures isolated to users created by this file.
 */

interface FixtureUser {
  id: number;
  username: string;
}

interface FixtureRobot {
  id: number;
  name: string;
}

function createApp(userRateLimitMax: number): express.Express {
  const app = express();
  const config = getConfig();

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(requestLogger);
  app.use('/api', createGeneralLimiter(config));
  app.use(
    '/api/search',
    authenticateToken,
    createUserEconomicLimiter({ ...config, userEconomicRateLimitMax: userRateLimitMax }),
  );

  app.use('/api/search', searchRoutes);
  app.use('/api/robots', robotRoutes);
  app.use('/api/stables', stableRoutes);
  app.use('/api/guide', guideRoutes);
  app.use(errorHandler);

  return app;
}

async function listen(app: express.Express): Promise<Server> {
  return new Promise<Server>((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function signToken(user: FixtureUser): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: 'user',
      tokenVersion: 0,
    },
    getConfig().jwtSecret,
    { expiresIn: '1h' },
  );
}

function expectSafeResponse(body: unknown): asserts body is SearchResponse {
  const response = body as SearchResponse;
  expect(Object.keys(response)).toEqual(['robots', 'stables', 'guide']);
  expect(Array.isArray(response.robots)).toBe(true);
  expect(Array.isArray(response.stables)).toBe(true);
  expect(Array.isArray(response.guide)).toBe(true);
  expect(response.robots.length).toBeLessThanOrEqual(10);
  expect(response.stables.length).toBeLessThanOrEqual(10);
  expect(response.guide.length).toBeLessThanOrEqual(10);
  expect(response.robots.length + response.stables.length + response.guide.length).toBeLessThanOrEqual(30);

  for (const result of response.robots) {
    expect(Object.keys(result).sort()).toEqual(
      ['category', 'id', 'label', ...(result.subtitle === undefined ? [] : ['subtitle'])].sort(),
    );
    expect(result.category).toBe('robots');
    expect(result.id).toBeGreaterThan(0);
  }
  for (const result of response.stables) {
    expect(Object.keys(result).sort()).toEqual(['category', 'label', 'userId'].sort());
    expect(result.category).toBe('stables');
    expect(result.userId).toBeGreaterThan(0);
  }
  for (const result of response.guide) {
    expect(Object.keys(result).sort()).toEqual(
      ['articleSlug', 'category', 'sectionSlug', 'sectionTitle', 'title'].sort(),
    );
    expect(result.category).toBe('guide');
    expect(result.sectionSlug).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(result.articleSlug).toMatch(/^[a-zA-Z0-9_-]+$/);
  }

  const serialized = JSON.stringify(response);
  expect(serialized).not.toContain('username');
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('profileVisibility');
  expect(serialized).not.toContain('bodyText');
  expect(serialized).not.toContain('targetRoute');
  expect(serialized).not.toContain('route');
}

function diagnosticText(calls: unknown[][]): string {
  return JSON.stringify(calls);
}

describe('GET /api/search — PostgreSQL integration', () => {
  let server: Server;
  let limitedServer: Server;
  let searchUser: FixtureUser;
  let ownerUser: FixtureUser;
  let otherUser: FixtureUser;
  let generatedUser: FixtureUser;
  let testNamedUser: FixtureUser;
  let nullNameUser: FixtureUser;
  let emptyNameUser: FixtureUser;
  let whitespaceNameUser: FixtureUser;
  let clearedNameUser: FixtureUser;
  let usernameOnlyUser: FixtureUser;
  let searchRobot: FixtureRobot;
  let ownerRobot: FixtureRobot;
  let otherRobot: FixtureRobot;
  let searchTerm: string;
  let generatedStableName: string;
  let testStableName: string;
  let searchStableName: string;
  let suffix: string;
  const fixtureUserIds: number[] = [];
  const fixtureRobotIds: number[] = [];

  async function createFixtureUser(data: {
    username: string;
    stableName?: string | null;
    isGenerated?: boolean;
  }): Promise<FixtureUser> {
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: 'integration-test-password-hash',
        stableName: data.stableName,
        isGenerated: data.isGenerated ?? false,
      },
      select: { id: true, username: true },
    });
    fixtureUserIds.push(user.id);
    return user;
  }

  async function createFixtureRobot(userId: number, name: string): Promise<FixtureRobot> {
    const robot = await createTestRobot(userId, name);
    fixtureRobotIds.push(robot.id);
    return { id: robot.id, name: robot.name };
  }

  beforeAll(async () => {
    await prisma.$connect();
    suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const guideEntry = guideService
      .getSearchIndex()
      .find((entry) => /[a-zA-Z0-9]{2,}/.test(entry.title));
    searchTerm = (guideEntry?.title.match(/[a-zA-Z0-9]{2,}/)?.[0] ?? 'Guide').slice(0, 12);

    searchStableName = `${searchTerm} Search Stable`;
    generatedStableName = `${searchTerm} Generated`;
    testStableName = `${searchTerm} Test`;

    searchUser = await createFixtureUser({
      username: `search_player_${suffix}`,
      stableName: searchStableName,
    });
    ownerUser = await createFixtureUser({
      username: `owner_player_${suffix}`,
      stableName: `${searchTerm} Owner Stable`,
    });
    otherUser = await createFixtureUser({
      username: `other_player_${suffix}`,
      stableName: `${searchTerm} Other Stable`,
    });
    generatedUser = await createFixtureUser({
      username: `generated_${suffix}`,
      stableName: generatedStableName,
      isGenerated: true,
    });
    testNamedUser = await createFixtureUser({
      username: `test_user_search_${suffix}`,
      stableName: testStableName,
    });
    nullNameUser = await createFixtureUser({
      username: `null_name_${suffix}`,
      stableName: null,
    });
    emptyNameUser = await createFixtureUser({
      username: `empty_name_${suffix}`,
      stableName: '',
    });
    whitespaceNameUser = await createFixtureUser({
      username: `whitespace_name_${suffix}`,
      stableName: '   ',
    });
    clearedNameUser = await createFixtureUser({
      username: `cleared_name_${suffix}`,
      stableName: `${searchTerm} Cleared`,
    });
    usernameOnlyUser = await createFixtureUser({
      username: `scope_only_${suffix}`,
      stableName: null,
    });

    await prisma.user.update({
      where: { id: clearedNameUser.id },
      data: { stableName: null },
    });

    searchRobot = await createFixtureRobot(searchUser.id, `${searchTerm} Search Robot`);
    ownerRobot = await createFixtureRobot(ownerUser.id, `${searchTerm} Owner Robot`);
    otherRobot = await createFixtureRobot(otherUser.id, `${searchTerm} Other Robot`);

    server = await listen(createApp(1_000));
  });

  afterAll(async () => {
    if (limitedServer) await close(limitedServer);
    await close(server);

    await prisma.searchAnalyticsEvent.deleteMany({
      where: { userId: { in: fixtureUserIds } },
    });
    await prisma.robot.deleteMany({ where: { id: { in: fixtureRobotIds } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  });

  describe('authentication and grouped source results', () => {
    it('should reject unauthenticated search without returning grouped data or creating analytics events', async () => {
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      const createEventSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');

      try {
        const response = await request(server)
          .get('/api/search')
          .query({ q: searchTerm });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Access token required' });
        expect(response.body).not.toHaveProperty('robots');
        expect(response.body).not.toHaveProperty('stables');
        expect(response.body).not.toHaveProperty('guide');
        expect(createEventSpy).not.toHaveBeenCalled();
      } finally {
        createEventSpy.mockRestore();
      }

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents).toBe(beforeEvents);
    });

    it('should return all three source groups in one request with bounded safe DTOs', async () => {
      const createEventSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });

      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: ` ${searchTerm} ` });

      expect(response.status).toBe(200);
      expectSafeResponse(response.body);
      expect(response.body.robots.some((result) => result.id === searchRobot.id)).toBe(true);
      expect(response.body.stables.some((result) => result.label === searchStableName)).toBe(true);
      expect(response.body.guide.length).toBeGreaterThan(0);
      expect(createEventSpy).toHaveBeenCalledTimes(1);

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents - beforeEvents).toBe(1);
      createEventSpy.mockRestore();
    });

    it('should search robots by name and stables by named stableName, including generated and test stables', async () => {
      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: searchTerm });

      expect(response.status).toBe(200);
      expectSafeResponse(response.body);
      expect(response.body.robots.map((result) => result.label)).toEqual(
        expect.arrayContaining([searchRobot.name, ownerRobot.name, otherRobot.name]),
      );
      expect(response.body.stables.map((result) => result.label)).toEqual(
        expect.arrayContaining([searchStableName, generatedStableName, testStableName]),
      );
      expect(response.body.stables.find((result) => result.label === generatedStableName)?.userId)
        .toBe(generatedUser.id);
      expect(response.body.stables.find((result) => result.label === testStableName)?.userId)
        .toBe(testNamedUser.id);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(usernameOnlyUser.username);
      expect(serialized).not.toContain(nullNameUser.username);
      expect(serialized).not.toContain(emptyNameUser.username);
      expect(serialized).not.toContain(whitespaceNameUser.username);
      expect(serialized).not.toContain(clearedNameUser.username);
    });

    it('should omit null, empty, whitespace-only, and cleared stable names', async () => {
      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: `${searchTerm} Cleared` });

      expect(response.status).toBe(200);
      expectSafeResponse(response.body);
      expect(response.body.stables).toEqual([]);
    });

    it('should not match username-only accounts or unrelated search categories', async () => {
      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: usernameOnlyUser.username });

      expect(response.status).toBe(200);
      expectSafeResponse(response.body);
      expect(response.body.robots).toEqual([]);
      expect(response.body.stables).toEqual([]);
      expect(response.body.guide).toEqual([]);
    });
  });

  describe('destination access and route-safe references', () => {
    it('should preserve owner and non-owner robot destination behavior', async () => {
      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: ownerRobot.name });
      expect(response.status).toBe(200);
      expectSafeResponse(response.body);

      const robotResult = response.body.robots.find((result) => result.id === ownerRobot.id);
      expect(robotResult).toEqual({
        category: 'robots',
        id: ownerRobot.id,
        label: ownerRobot.name,
        subtitle: `${searchTerm} Owner Stable`,
      });
      expect(robotResult).not.toHaveProperty('route');
      expect(robotResult).not.toHaveProperty('targetRoute');

      const ownerDestination = await request(server)
        .get(`/api/robots/${ownerRobot.id}`)
        .set('Authorization', `Bearer ${signToken(ownerUser)}`);
      const nonOwnerDestination = await request(server)
        .get(`/api/robots/${ownerRobot.id}`)
        .set('Authorization', `Bearer ${signToken(otherUser)}`);

      expect(ownerDestination.status).toBe(200);
      expect(nonOwnerDestination.status).toBe(200);
      expect(ownerDestination.body.currentHP).toBeDefined();
      expect(nonOwnerDestination.body.currentHP).toBeUndefined();
      expect(nonOwnerDestination.body).not.toHaveProperty('passwordHash');
    });

    it('should use stable and guide result identities with their existing destination routes', async () => {
      const response = await request(server)
        .get('/api/search')
        .set('Authorization', `Bearer ${signToken(searchUser)}`)
        .query({ q: searchTerm });
      expect(response.status).toBe(200);
      expectSafeResponse(response.body);

      const stableResult = response.body.stables.find((result) => result.userId === searchUser.id);
      expect(stableResult).toEqual({
        category: 'stables',
        userId: searchUser.id,
        label: searchStableName,
      });

      const stableOwnerDestination = await request(server)
        .get(`/api/stables/${searchUser.id}`)
        .set('Authorization', `Bearer ${signToken(searchUser)}`);
      const stableNonOwnerDestination = await request(server)
        .get(`/api/stables/${searchUser.id}`)
        .set('Authorization', `Bearer ${signToken(otherUser)}`);

      expect(stableOwnerDestination.status).toBe(200);
      expect(stableNonOwnerDestination.status).toBe(200);
      expect(stableOwnerDestination.body.user).toMatchObject({ id: searchUser.id, stableName: searchStableName });
      expect(stableNonOwnerDestination.body.user).toMatchObject({ id: searchUser.id, stableName: searchStableName });
      expect(stableNonOwnerDestination.body).not.toHaveProperty('passwordHash');

      const guideResult = response.body.guide[0];
      const guideDestination = await request(server)
        .get(`/api/guide/articles/${guideResult.sectionSlug}/${guideResult.articleSlug}`)
        .set('Authorization', `Bearer ${signToken(searchUser)}`);

      expect(guideDestination.status).toBe(200);
      expect(guideDestination.body).toHaveProperty('body');
      expect(response.body.guide[0]).not.toHaveProperty('body');
      expect(response.body.guide[0]).not.toHaveProperty('bodyText');
    });
  });

  describe('strict input and parameterization', () => {
    it('should reject missing, unknown, repeated, nested/non-string, and over-length query input without source or analytics work', async () => {
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      const robotFindManySpy = jest.spyOn(prisma.robot, 'findMany');
      const stableFindManySpy = jest.spyOn(prisma.user, 'findMany');
      const guideIndexSpy = jest.spyOn(guideService, 'getSearchIndex');
      const createEventSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');

      try {
        const malformedResponses = await Promise.all([
          request(server)
            .get('/api/search')
            .set('Authorization', `Bearer ${signToken(searchUser)}`),
          request(server)
            .get('/api/search')
            .set('Authorization', `Bearer ${signToken(searchUser)}`)
            .query({ q: searchTerm, unknown: 'not-allowed' }),
          request(server)
            .get(`/api/search?q=${encodeURIComponent(searchTerm)}&q=other`)
            .set('Authorization', `Bearer ${signToken(searchUser)}`),
          request(server)
            .get('/api/search')
            .set('Authorization', `Bearer ${signToken(searchUser)}`)
            .query({ q: { nested: searchTerm } }),
          request(server)
            .get('/api/search')
            .set('Authorization', `Bearer ${signToken(searchUser)}`)
            .query({ q: ` ${'x'.repeat(101)} ` }),
        ]);

        for (const response of malformedResponses) {
          expect(response.status).toBe(400);
          expect(response.body.code).toBe('VALIDATION_ERROR');
          expect(JSON.stringify(response.body)).not.toContain(searchTerm);
        }
        expect(robotFindManySpy).not.toHaveBeenCalled();
        expect(stableFindManySpy).not.toHaveBeenCalled();
        expect(guideIndexSpy).not.toHaveBeenCalled();
        expect(createEventSpy).not.toHaveBeenCalled();
      } finally {
        robotFindManySpy.mockRestore();
        stableFindManySpy.mockRestore();
        guideIndexSpy.mockRestore();
        createEventSpy.mockRestore();
      }

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents).toBe(beforeEvents);
    });

    it('should return empty groups for a short normalized query without source or analytics work', async () => {
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      const robotFindManySpy = jest.spyOn(prisma.robot, 'findMany');
      const stableFindManySpy = jest.spyOn(prisma.user, 'findMany');
      const guideIndexSpy = jest.spyOn(guideService, 'getSearchIndex');
      const createEventSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');

      try {
        const response = await request(server)
          .get('/api/search')
          .set('Authorization', `Bearer ${signToken(searchUser)}`)
          .query({ q: ' a ' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ robots: [], stables: [], guide: [] });
        expect(robotFindManySpy).not.toHaveBeenCalled();
        expect(stableFindManySpy).not.toHaveBeenCalled();
        expect(guideIndexSpy).not.toHaveBeenCalled();
        expect(createEventSpy).not.toHaveBeenCalled();
      } finally {
        robotFindManySpy.mockRestore();
        stableFindManySpy.mockRestore();
        guideIndexSpy.mockRestore();
        createEventSpy.mockRestore();
      }

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents).toBe(beforeEvents);
    });

    it('should treat SQL-like input as a parameter value rather than executable SQL', async () => {
      const sqlLike = `' OR 1=1 -- ${suffix}`;
      const robotFindManySpy = jest.spyOn(prisma.robot, 'findMany');
      const stableFindManySpy = jest.spyOn(prisma.user, 'findMany');

      try {
        const response = await request(server)
          .get('/api/search')
          .set('Authorization', `Bearer ${signToken(searchUser)}`)
          .query({ q: sqlLike });

        expect(response.status).toBe(200);
        expectSafeResponse(response.body);
        expect(response.body.robots).toEqual([]);
        expect(response.body.stables).toEqual([]);
        expect(response.body.guide).toEqual([]);
        expect(robotFindManySpy.mock.calls[0][0]).toEqual({
          where: { name: { contains: sqlLike, mode: 'insensitive' } },
          select: {
            id: true,
            name: true,
            user: { select: { stableName: true } },
          },
        });
        expect(stableFindManySpy.mock.calls[0][0]).toEqual({
          where: {
            AND: [
              { stableName: { not: null } },
              { stableName: { not: '' } },
              { stableName: { contains: sqlLike, mode: 'insensitive' } },
            ],
          },
          select: { id: true, stableName: true },
        });
      } finally {
        robotFindManySpy.mockRestore();
        stableFindManySpy.mockRestore();
      }
    });
  });

  describe('rate limiting and diagnostics', () => {
    it('should apply the existing authenticated per-user rate limit and redact the query from diagnostics', async () => {
      limitedServer = await listen(createApp(2));
      const phrase = `RateLimitSecret_${suffix}`;
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      const token = signToken(searchUser);
      const warningSpy = jest.spyOn(logger, 'warn');
      const debugSpy = jest.spyOn(logger, 'debug');
      const validationSpy = jest.spyOn(securityMonitor, 'logValidationFailure');
      const rateLimitSpy = jest.spyOn(securityMonitor, 'trackRateLimitViolation');

      try {
        const first = await request(limitedServer)
          .get('/api/search')
          .set('Authorization', `Bearer ${token}`)
          .query({ q: phrase });
        const second = await request(limitedServer)
          .get('/api/search')
          .set('Authorization', `Bearer ${token}`)
          .query({ q: phrase });
        const limited = await request(limitedServer)
          .get('/api/search')
          .set('Authorization', `Bearer ${token}`)
          .query({ q: phrase });

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(limited.status).toBe(429);
        expect(limited.body).toEqual({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
        });
        expect(rateLimitSpy).toHaveBeenCalledWith(searchUser.id, '/api/search');
        expect(validationSpy).not.toHaveBeenCalled();

        const logs = diagnosticText([
          ...warningSpy.mock.calls,
          ...debugSpy.mock.calls,
          ...rateLimitSpy.mock.calls,
        ]);
        expect(logs).not.toContain(phrase);
        expect(logs).toContain('/api/search');
      } finally {
        warningSpy.mockRestore();
        debugSpy.mockRestore();
        validationSpy.mockRestore();
        rateLimitSpy.mockRestore();
      }

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents - beforeEvents).toBe(2);
    });

    it('should convert source failures to a safe error and make no analytics attempt or event', async () => {
      const phrase = `SourceFailureSecret_${suffix}`;
      const beforeEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      const robotFindManySpy = jest
        .spyOn(prisma.robot, 'findMany')
        .mockRejectedValueOnce(new Error(`database query leaked ${phrase}`));
      const createEventSpy = jest.spyOn(searchAnalyticsStore, 'createEvent');
      const warningSpy = jest.spyOn(logger, 'warn');
      const errorSpy = jest.spyOn(logger, 'error');

      try {
        const response = await request(server)
          .get('/api/search')
          .set('Authorization', `Bearer ${signToken(searchUser)}`)
          .query({ q: phrase });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          error: 'Search is temporarily unavailable',
          code: 'INTERNAL_ERROR',
        });
        expect(JSON.stringify(response.body)).not.toContain(phrase);
        expect(createEventSpy).not.toHaveBeenCalled();

        const logs = diagnosticText([
          ...warningSpy.mock.calls,
          ...errorSpy.mock.calls,
        ]);
        expect(logs).not.toContain(phrase);
        expect(logs).toContain('/api/search');
      } finally {
        robotFindManySpy.mockRestore();
        createEventSpy.mockRestore();
        warningSpy.mockRestore();
        errorSpy.mockRestore();
      }

      const afterEvents = await prisma.searchAnalyticsEvent.count({
        where: { userId: searchUser.id },
      });
      expect(afterEvents).toBe(beforeEvents);
    });
  });
});
