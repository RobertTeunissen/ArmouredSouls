/**
 * Unit tests for Guide Router.
 * Tests 200/401/404 responses and Property 1 (authenticated access without progression gating).
 *
 * Validates: Requirements 1.3, 18.1
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as fc from 'fast-check';

import guideRoutes from '../../routes/guide';
import prisma from '../../lib/prisma';
import { getConfig } from '../../config/env';
import { errorHandler } from '../../middleware/errorHandler';

// Signed with the secret the middleware will actually verify against, read from the
// same memoised config it reads. This file used to assign `process.env.JWT_SECRET`
// above the route import and rely on that assignment running first — an ordering
// assumption an ES import hoist can quietly break.
const TEST_JWT_SECRET = getConfig().jwtSecret;

// Mock the logger to suppress output during tests
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock GuideService so tests don't depend on actual content files
jest.mock('../../services/common/guide-service', () => ({
  __esModule: true,
  default: {
    getSections: jest.fn(),
    getArticle: jest.fn(),
    getSearchIndex: jest.fn(),
  },
}));

import guideService from '../../services/common/guide-service';

const mockedGuideService = guideService as jest.Mocked<typeof guideService>;

// --- Test helpers ---

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/guide', guideRoutes);
  // `errorHandler` is what turns a thrown AppError into `{ error, code, details }`.
  // Without it Express's default handler sends the right status with an empty body,
  // so the 404 case asserted a body the app could not have produced.
  app.use(errorHandler);
  return app;
}

/**
 * Sign a token for a user that exists.
 *
 * `authenticateToken` reads the user row to check `tokenVersion` and to resolve the
 * role, so a token for an id with no row is rejected with 401 however well-formed it
 * is. This file previously signed for a hard-coded id 1 and, in the property below,
 * for generated ids in 1..100000 — none of which it created — so every authenticated
 * case 401'd.
 */
function generateToken(user: { userId: number; username: string; role: string }): string {
  return jwt.sign({ ...user, tokenVersion: 0 }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

const MOCK_SECTIONS = [
  {
    slug: 'combat',
    title: 'Combat',
    order: 1,
    articles: [
      {
        slug: 'battle-flow',
        title: 'Battle Flow',
        description: 'How battles work',
        sectionSlug: 'combat',
        lastUpdated: '2026-02-01',
      },
    ],
  },
];

const MOCK_ARTICLE = {
  slug: 'battle-flow',
  title: 'Battle Flow',
  description: 'How battles work',
  sectionSlug: 'combat',
  sectionTitle: 'Combat',
  body: '## Overview\n\nBattle flow explanation.',
  lastUpdated: '2026-02-01',
  relatedArticles: [],
  previousArticle: null,
  nextArticle: null,
  headings: [{ level: 2, text: 'Overview', id: 'overview' }],
};

const MOCK_SEARCH_INDEX = [
  {
    slug: 'battle-flow',
    title: 'Battle Flow',
    sectionSlug: 'combat',
    sectionTitle: 'Combat',
    description: 'How battles work',
    bodyText: 'Battle flow explanation.',
  },
];

let DEFAULT_USER: { userId: number; username: string; role: string };

// --- Test suites ---

describe('Guide Router', () => {
  let app: express.Express;
  /**
   * One listening server for the whole file.
   *
   * `request(server)` stands up a fresh ephemeral server per call and tears it down
   * again. The property below issues 300 requests, and that churn produced a
   * `socket hang up` — and, in an earlier run, a 426 that no code in this repository
   * returns — roughly once per full-tier run. Passing an already-listening server to
   * supertest reuses one socket pair instead of 300.
   */
  let server: import('node:http').Server;
  let testUserId: number;

  beforeAll(async () => {
    app = createApp();
    server = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const user = await prisma.user.create({
      data: {
        username: `guide_routes_${Date.now()}`,
        passwordHash: 'not-used-by-these-routes',
        role: 'user',
      },
    });
    testUserId = user.id;
    DEFAULT_USER = { userId: user.id, username: user.username, role: user.role };
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuideService.getSections.mockReturnValue(MOCK_SECTIONS as unknown as ReturnType<typeof guideService.getSections>);
    mockedGuideService.getArticle.mockReturnValue(MOCK_ARTICLE as unknown as ReturnType<typeof guideService.getArticle>);
    mockedGuideService.getSearchIndex.mockReturnValue(MOCK_SEARCH_INDEX as unknown as ReturnType<typeof guideService.getSearchIndex>);
  });

  // --- 401 for unauthenticated requests ---

  describe('unauthenticated requests', () => {
    it('should return 401 when GET /api/guide/sections has no token', async () => {
      const res = await request(server).get('/api/guide/sections');
      expect(res.status).toBe(401);
    });

    it('should return 401 when GET /api/guide/articles/:s/:a has no token', async () => {
      const res = await request(server).get('/api/guide/articles/combat/battle-flow');
      expect(res.status).toBe(401);
    });

    it('should return 401 when GET /api/guide/search-index has no token', async () => {
      const res = await request(server).get('/api/guide/search-index');
      expect(res.status).toBe(401);
    });
  });

  // --- 200 for valid authenticated requests ---

  describe('authenticated requests with valid data', () => {
    it('should return 200 and sections for GET /api/guide/sections', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(server)
        .get('/api/guide/sections')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(MOCK_SECTIONS);
      expect(mockedGuideService.getSections).toHaveBeenCalledTimes(1);
    });

    it('should return 200 and article for GET /api/guide/articles/:s/:a', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(server)
        .get('/api/guide/articles/combat/battle-flow')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(MOCK_ARTICLE);
      expect(mockedGuideService.getArticle).toHaveBeenCalledWith('combat', 'battle-flow');
    });

    it('should return 200 and search index for GET /api/guide/search-index', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(server)
        .get('/api/guide/search-index')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(MOCK_SEARCH_INDEX);
      expect(mockedGuideService.getSearchIndex).toHaveBeenCalledTimes(1);
    });
  });

  // --- 404 for non-existent article ---

  describe('non-existent article', () => {
    it('should return 404 with error message when article does not exist', async () => {
      mockedGuideService.getArticle.mockReturnValue(null);
      const token = generateToken(DEFAULT_USER);
      const res = await request(server)
        .get('/api/guide/articles/nonexistent/article')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      // The standard error body carries a `code` alongside `error`.
      expect(res.body).toEqual({ error: 'Article not found', code: 'ARTICLE_NOT_FOUND' });
    });
  });

  // --- Property 1: Authenticated access without progression gating ---
  // Feature: in-game-guide, Property 1: Authenticated access without progression gating
  // Validates: Requirements 1.3

  describe('Property 1: Authenticated access without progression gating', () => {
    it('should return 200 (never 403) for any authenticated user regardless of progression fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // `userId` is pinned to the real row below rather than generated: this
          // property is about progression fields not gating access, and a generated
          // id would only re-test that authentication rejects unknown users.
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/),
            role: fc.constantFrom('user', 'admin'),
            prestige: fc.integer({ min: 0, max: 1000000 }),
            leagueTier: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
            robotCount: fc.integer({ min: 0, max: 50 }),
            accountAge: fc.integer({ min: 0, max: 3650 }),
            fame: fc.integer({ min: 0, max: 500000 }),
          }),
          async (user) => {
            // Sign a JWT with all user fields (including progression-related extras)
            const token = jwt.sign(
              { ...user, userId: testUserId, tokenVersion: 0 },
              TEST_JWT_SECRET,
              { expiresIn: '1h' },
            );

            // Sequential, and against the shared server. The property is about status
            // codes, not concurrency, so three concurrent requests bought nothing and
            // tripled the socket churn.
            const sectionsRes = await request(server)
              .get('/api/guide/sections')
              .set('Authorization', `Bearer ${token}`);
            const articleRes = await request(server)
              .get('/api/guide/articles/combat/battle-flow')
              .set('Authorization', `Bearer ${token}`);
            const searchRes = await request(server)
              .get('/api/guide/search-index')
              .set('Authorization', `Bearer ${token}`);

            // All endpoints must return 200, never 403. Thrown rather than expect()ed so
            // an unexpected status arrives with its headers and body attached.
            for (const [name, res] of [
              ['sections', sectionsRes],
              ['article', articleRes],
              ['search-index', searchRes],
            ] as const) {
              if (res.status !== 200) {
                throw new Error(
                  `${name}: expected 200, got ${res.status} ` +
                    `headers=${JSON.stringify(res.headers)} body=${JSON.stringify(res.body)}`,
                );
              }
            }

            expect(sectionsRes.status).not.toBe(403);
            expect(articleRes.status).not.toBe(403);
            expect(searchRes.status).not.toBe(403);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
