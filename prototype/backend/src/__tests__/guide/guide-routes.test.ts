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

// Set JWT_SECRET before importing routes so the auth middleware picks it up
const TEST_JWT_SECRET = 'test-guide-routes-secret';
process.env.JWT_SECRET = TEST_JWT_SECRET;

import guideRoutes from '../../routes/guide';

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
jest.mock('../../services/guide-service', () => ({
  __esModule: true,
  default: {
    getSections: jest.fn(),
    getArticle: jest.fn(),
    getSearchIndex: jest.fn(),
  },
}));

import guideService from '../../services/guide-service';

const mockedGuideService = guideService as jest.Mocked<typeof guideService>;

// --- Test helpers ---

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/guide', guideRoutes);
  return app;
}

function generateToken(user: { userId: number; username: string; role: string }): string {
  return jwt.sign(user, TEST_JWT_SECRET, { expiresIn: '1h' });
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

const DEFAULT_USER = { userId: 1, username: 'testuser', role: 'user' };

// --- Test suites ---

describe('Guide Router', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
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
      const res = await request(app).get('/api/guide/sections');
      expect(res.status).toBe(401);
    });

    it('should return 401 when GET /api/guide/articles/:s/:a has no token', async () => {
      const res = await request(app).get('/api/guide/articles/combat/battle-flow');
      expect(res.status).toBe(401);
    });

    it('should return 401 when GET /api/guide/search-index has no token', async () => {
      const res = await request(app).get('/api/guide/search-index');
      expect(res.status).toBe(401);
    });
  });

  // --- 200 for valid authenticated requests ---

  describe('authenticated requests with valid data', () => {
    it('should return 200 and sections for GET /api/guide/sections', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(app)
        .get('/api/guide/sections')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(MOCK_SECTIONS);
      expect(mockedGuideService.getSections).toHaveBeenCalledTimes(1);
    });

    it('should return 200 and article for GET /api/guide/articles/:s/:a', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(app)
        .get('/api/guide/articles/combat/battle-flow')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(MOCK_ARTICLE);
      expect(mockedGuideService.getArticle).toHaveBeenCalledWith('combat', 'battle-flow');
    });

    it('should return 200 and search index for GET /api/guide/search-index', async () => {
      const token = generateToken(DEFAULT_USER);
      const res = await request(app)
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
      const res = await request(app)
        .get('/api/guide/articles/nonexistent/article')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Article not found' });
    });
  });

  // --- Property 1: Authenticated access without progression gating ---
  // Feature: in-game-guide, Property 1: Authenticated access without progression gating
  // Validates: Requirements 1.3

  describe('Property 1: Authenticated access without progression gating', () => {
    it('should return 200 (never 403) for any authenticated user regardless of progression fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.integer({ min: 1, max: 100000 }),
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
            const token = jwt.sign(user, TEST_JWT_SECRET, { expiresIn: '1h' });

            const [sectionsRes, articleRes, searchRes] = await Promise.all([
              request(app)
                .get('/api/guide/sections')
                .set('Authorization', `Bearer ${token}`),
              request(app)
                .get('/api/guide/articles/combat/battle-flow')
                .set('Authorization', `Bearer ${token}`),
              request(app)
                .get('/api/guide/search-index')
                .set('Authorization', `Bearer ${token}`),
            ]);

            // All endpoints must return 200, never 403
            expect(sectionsRes.status).toBe(200);
            expect(articleRes.status).toBe(200);
            expect(searchRes.status).toBe(200);

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
