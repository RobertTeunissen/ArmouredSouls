/**
 * Route tests for Security & Moderation (`/api/admin/security/overview`,
 * `/api/admin/images*`): validation, status codes, the standard error shape,
 * and that each page action reaches its service with the admin's id. Services
 * are mocked; the database behaviour is in
 * tests/integration/adminSecurityModeration.test.ts.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/errorHandler';
import { ModerationError, ModerationErrorCode } from '../../src/errors/moderationErrors';

const mockOverview = jest.fn();
jest.mock('../../src/services/security/securityOverviewService', () => ({
  __esModule: true,
  SECURITY_WINDOWS: ['24h', '7d', '30d'],
  getSecurityOverview: (...args: unknown[]) => mockOverview(...args),
}));
const mockImagesOverview = jest.fn();
const mockList = jest.fn();
const mockDetail = jest.fn();
const mockRemove = jest.fn();
const mockPreview = jest.fn();
const mockCleanup = jest.fn();
jest.mock('../../src/services/moderation/adminImagesService', () => ({
  __esModule: true,
  getImagesOverview: (...args: unknown[]) => mockImagesOverview(...args),
  listImagesInUse: (...args: unknown[]) => mockList(...args),
  getImageDetail: (...args: unknown[]) => mockDetail(...args),
  removeImage: (...args: unknown[]) => mockRemove(...args),
  previewCleanup: (...args: unknown[]) => mockPreview(...args),
  runCleanup: (...args: unknown[]) => mockCleanup(...args),
}));
jest.mock('../../src/config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: { logValidationFailure: jest.fn(), logAuthorizationFailure: jest.fn(), trackRateLimitViolation: jest.fn() },
}));

let mockUser: { userId: number; username: string; role: string } | null = null;
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: { user?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'Access token required', code: 'AUTH_REQUIRED' });
    req.user = mockUser;
    next();
  },
  requireAdmin: (req: { user?: { role: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
    next();
  },
}));

import moderationRoutes from '../../src/routes/adminModeration';

const app = express();
app.use(express.json());
app.use('/api/admin', moderationRoutes);
app.use(errorHandler);

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { userId: 7, username: 'admin', role: 'admin' };
});

describe('GET /api/admin/security/overview', () => {
  it('defaults to the last 7 days', async () => {
    mockOverview.mockResolvedValue({ window: '7d' });
    const res = await request(baseUrl).get('/api/admin/security/overview');
    expect(res.status).toBe(200);
    expect(mockOverview).toHaveBeenCalledWith('7d');
  });

  it('accepts 24h and 30d and rejects anything else', async () => {
    mockOverview.mockResolvedValue({});
    expect((await request(baseUrl).get('/api/admin/security/overview?window=24h')).status).toBe(200);
    expect(mockOverview).toHaveBeenLastCalledWith('24h');
    const bad = await request(baseUrl).get('/api/admin/security/overview?window=1y');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });

  it('is admin-only', async () => {
    mockUser = { userId: 8, username: 'player', role: 'user' };
    expect((await request(baseUrl).get('/api/admin/security/overview')).status).toBe(403);
    mockUser = null;
    expect((await request(baseUrl).get('/api/admin/security/overview')).status).toBe(401);
    expect(mockOverview).not.toHaveBeenCalled();
  });
});

describe('Image Uploads reads', () => {
  it('returns the overview', async () => {
    mockImagesOverview.mockResolvedValue({ inUse: { images: 62 } });
    const res = await request(baseUrl).get('/api/admin/images/overview');
    expect(res.status).toBe(200);
    expect(res.body.inUse.images).toBe(62);
  });

  it('lists images with filter, search and page defaults', async () => {
    mockList.mockResolvedValue({ images: [], total: 0 });
    await request(baseUrl).get('/api/admin/images');
    expect(mockList).toHaveBeenLastCalledWith('all', '', 1);
    await request(baseUrl).get('/api/admin/images?filter=anyway&q=iron&page=2');
    expect(mockList).toHaveBeenLastCalledWith('anyway', 'iron', 2);
    expect((await request(baseUrl).get('/api/admin/images?filter=nsfw')).status).toBe(400);
    expect((await request(baseUrl).get(`/api/admin/images?q=${'x'.repeat(51)}`)).status).toBe(400);
  });

  it('returns one image, 404 when it is gone, 400 for a bad id', async () => {
    mockDetail.mockResolvedValueOnce({ id: 5 });
    expect((await request(baseUrl).get('/api/admin/images/5')).body).toEqual({ id: 5 });
    expect(mockDetail).toHaveBeenCalledWith(5);

    mockDetail.mockRejectedValueOnce(new ModerationError(ModerationErrorCode.IMAGE_NOT_FOUND, 'Image not found', 404));
    const missing = await request(baseUrl).get('/api/admin/images/6');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Image not found', code: 'IMAGE_NOT_FOUND' });

    expect((await request(baseUrl).get('/api/admin/images/abc')).status).toBe(400);
  });
});

describe('Remove image (button)', () => {
  it('removes with a reason and passes the admin id', async () => {
    mockRemove.mockResolvedValue({ imageUrl: '/uploads/user-robots/3/a.webp', robotsCleared: 2, archivedCleared: 0 });
    const res = await request(baseUrl).delete('/api/admin/images/5').send({ confirm: true, reason: 'explicit content past the filter' });
    expect(res.status).toBe(200);
    expect(res.body.robotsCleared).toBe(2);
    expect(mockRemove).toHaveBeenCalledWith(7, 5, 'explicit content past the filter');
  });

  it('refuses without confirmation or without a reason', async () => {
    expect((await request(baseUrl).delete('/api/admin/images/5').send({ reason: 'explicit content' })).status).toBe(400);
    expect((await request(baseUrl).delete('/api/admin/images/5').send({ confirm: true, reason: ' ' })).status).toBe(400);
    expect((await request(baseUrl).delete('/api/admin/images/5').send({ confirm: 'yes', reason: 'explicit content' })).status).toBe(400);
    expect(mockRemove).not.toHaveBeenCalled();
  });
});

describe('Storage cleanup (buttons)', () => {
  it('previews without changing anything', async () => {
    mockPreview.mockResolvedValue({ orphanCount: 0, missing: { robots: 0, archived: 30, paths: [] } });
    const res = await request(baseUrl).get('/api/admin/images/cleanup');
    expect(res.status).toBe(200);
    expect(res.body.missing.archived).toBe(30);
    expect(mockCleanup).not.toHaveBeenCalled();
  });

  it('runs the cleanup as the admin', async () => {
    mockCleanup.mockResolvedValue({ filesDeleted: 0, bytesReclaimed: 0, referencesCleared: { robots: 0, archived: 30 }, errors: [] });
    const res = await request(baseUrl).post('/api/admin/images/cleanup');
    expect(res.status).toBe(200);
    expect(res.body.referencesCleared.archived).toBe(30);
    expect(mockCleanup).toHaveBeenCalledWith(7);
  });

  it('is admin-only', async () => {
    mockUser = { userId: 8, username: 'player', role: 'user' };
    expect((await request(baseUrl).post('/api/admin/images/cleanup')).status).toBe(403);
    expect((await request(baseUrl).delete('/api/admin/images/5').send({ confirm: true, reason: 'explicit content' })).status).toBe(403);
    expect(mockCleanup).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
