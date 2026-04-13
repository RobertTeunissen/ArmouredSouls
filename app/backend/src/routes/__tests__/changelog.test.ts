/**
 * Unit tests for changelog routes — authorization, validation, and core behavior.
 *
 * Tests admin endpoints return 403 for non-admin users, player endpoints return
 * 401 without auth, and Zod validation rejects invalid inputs.
 *
 * Requirements: 9.1–9.9, 10.1–10.5
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockChangelogService = {
  listPublished: jest.fn(),
  getUnread: jest.fn(),
  getUnreadCount: jest.fn(),
  dismiss: jest.fn(),
  listAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  publish: jest.fn(),
};

const mockProcessAndStore = jest.fn();

jest.mock('../../services/changelog', () => ({
  changelogService: mockChangelogService,
  processAndStore: mockProcessAndStore,
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: {
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

const mockPrismaUser = {
  findUnique: jest.fn(),
};

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: mockPrismaUser,
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../config/env', () => ({
  getConfig: () => ({
    jwtSecret: 'test-changelog-secret',
    nodeEnv: 'test',
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import changelogRoutes from '../changelog';
import { errorHandler } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// Test app setup
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-changelog-secret';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/changelog', changelogRoutes);
  app.use(errorHandler);
  return app;
}

function adminToken(userId = 1, tokenVersion = 0): string {
  return jwt.sign(
    { userId, username: 'admin_user', role: 'admin', tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function userToken(userId = 2, tokenVersion = 0): string {
  return jwt.sign(
    { userId, username: 'regular_user', role: 'user', tokenVersion },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const VALID_ENTRY = {
  title: 'New Feature',
  body: 'We added a cool new feature to the game.',
  category: 'feature' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Changelog Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticateToken passes (user exists with matching tokenVersion)
    mockPrismaUser.findUnique.mockResolvedValue({
      tokenVersion: 0,
      stableName: 'Test Stable',
    });
    // Default service responses
    mockChangelogService.listPublished.mockResolvedValue({ entries: [], total: 0, page: 1, perPage: 20 });
    mockChangelogService.getUnread.mockResolvedValue([]);
    mockChangelogService.getUnreadCount.mockResolvedValue(0);
    mockChangelogService.dismiss.mockResolvedValue(undefined);
    mockChangelogService.listAll.mockResolvedValue({ entries: [], total: 0, page: 1, perPage: 20 });
    mockChangelogService.create.mockResolvedValue({ id: 1, ...VALID_ENTRY, status: 'draft' });
    mockChangelogService.update.mockResolvedValue({ id: 1, ...VALID_ENTRY, status: 'draft' });
    mockChangelogService.delete.mockResolvedValue(undefined);
    mockChangelogService.publish.mockResolvedValue({ id: 1, ...VALID_ENTRY, status: 'published', publishDate: new Date().toISOString() });
  });

  // -----------------------------------------------------------------------
  // Player endpoints — 401 without auth token
  // -----------------------------------------------------------------------

  describe('player endpoints return 401 without auth', () => {
    it('GET /api/changelog returns 401 without token', async () => {
      const res = await request(app).get('/api/changelog');
      expect(res.status).toBe(401);
    });

    it('GET /api/changelog/unread returns 401 without token', async () => {
      const res = await request(app).get('/api/changelog/unread');
      expect(res.status).toBe(401);
    });

    it('GET /api/changelog/unread/count returns 401 without token', async () => {
      const res = await request(app).get('/api/changelog/unread/count');
      expect(res.status).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // Admin endpoints — 403 for non-admin users
  // -----------------------------------------------------------------------

  describe('admin endpoints return 403 for non-admin users', () => {
    it('GET /api/changelog/admin returns 403 for non-admin', async () => {
      const res = await request(app)
        .get('/api/changelog/admin')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(403);
    });

    it('POST /api/changelog/admin returns 403 for non-admin', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${userToken()}`)
        .send(VALID_ENTRY);
      expect(res.status).toBe(403);
    });

    it('PUT /api/changelog/admin/1 returns 403 for non-admin', async () => {
      const res = await request(app)
        .put('/api/changelog/admin/1')
        .set('Authorization', `Bearer ${userToken()}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/changelog/admin/1 returns 403 for non-admin', async () => {
      const res = await request(app)
        .delete('/api/changelog/admin/1')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(403);
    });

    it('POST /api/changelog/admin/1/publish returns 403 for non-admin', async () => {
      const res = await request(app)
        .post('/api/changelog/admin/1/publish')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Validation — 400 for invalid inputs
  // -----------------------------------------------------------------------

  describe('validation rejects invalid inputs', () => {
    it('returns 400 for empty title', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...VALID_ENTRY, title: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for title > 200 chars', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...VALID_ENTRY, title: 'x'.repeat(201) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty body', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...VALID_ENTRY, body: '' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for body > 5000 chars', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...VALID_ENTRY, body: 'x'.repeat(5001) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid category', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ ...VALID_ENTRY, category: 'invalid_category' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for non-positive-integer ID param', async () => {
      const res = await request(app)
        .put('/api/changelog/admin/0')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for negative ID param', async () => {
      const res = await request(app)
        .delete('/api/changelog/admin/-5')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-numeric ID param', async () => {
      const res = await request(app)
        .post('/api/changelog/admin/abc/publish')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Publish action — sets status and publishDate
  // -----------------------------------------------------------------------

  describe('publish action', () => {
    it('calls service.publish and returns the published entry', async () => {
      const publishDate = new Date().toISOString();
      mockChangelogService.publish.mockResolvedValue({
        id: 1,
        ...VALID_ENTRY,
        status: 'published',
        publishDate,
      });

      const res = await request(app)
        .post('/api/changelog/admin/1/publish')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
      expect(res.body.publishDate).toBe(publishDate);
      expect(mockChangelogService.publish).toHaveBeenCalledWith(1);
    });
  });

  // -----------------------------------------------------------------------
  // Happy path — player endpoints work with auth
  // -----------------------------------------------------------------------

  describe('player endpoints work with valid auth', () => {
    it('GET /api/changelog returns published entries', async () => {
      const res = await request(app)
        .get('/api/changelog')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
    });

    it('GET /api/changelog/unread returns unread entries', async () => {
      const res = await request(app)
        .get('/api/changelog/unread')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(200);
    });

    it('GET /api/changelog/unread/count returns count', async () => {
      const res = await request(app)
        .get('/api/changelog/unread/count')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('count');
    });

    it('POST /api/changelog/dismiss returns success', async () => {
      const res = await request(app)
        .post('/api/changelog/dismiss')
        .set('Authorization', `Bearer ${userToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Admin endpoints work with admin auth
  // -----------------------------------------------------------------------

  describe('admin endpoints work with admin auth', () => {
    it('POST /api/changelog/admin creates entry', async () => {
      const res = await request(app)
        .post('/api/changelog/admin')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(VALID_ENTRY);
      expect(res.status).toBe(201);
      expect(mockChangelogService.create).toHaveBeenCalled();
    });

    it('PUT /api/changelog/admin/:id updates entry', async () => {
      const res = await request(app)
        .put('/api/changelog/admin/1')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(mockChangelogService.update).toHaveBeenCalledWith(1, { title: 'Updated Title' });
    });

    it('DELETE /api/changelog/admin/:id deletes entry', async () => {
      const res = await request(app)
        .delete('/api/changelog/admin/1')
        .set('Authorization', `Bearer ${adminToken()}`);
      expect(res.status).toBe(204);
      expect(mockChangelogService.delete).toHaveBeenCalledWith(1);
    });
  });
});
