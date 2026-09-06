import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const mockGetAvailability = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  authenticateToken: (req: Request & { user?: { userId: number } }, _res: Response, next: NextFunction) => {
    req.user = { userId: 1 };
    next();
  },
}));

jest.mock('../../src/services/moderation', () => ({
  __esModule: true,
  contentModerationService: {
    getAvailability: () => mockGetAvailability(),
  },
  uploadRateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  handleImagePreview: jest.fn(),
  handleImageConfirm: jest.fn(),
}));

import robotRoutes from '../../src/routes/robots';

const app = express();
app.use(express.json());
app.use('/api/robots', robotRoutes);

describe('Robot moderation availability route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return only the player-safe moderation lifecycle state', async () => {
    mockGetAvailability.mockReturnValue({
      status: 'unavailable',
      changedAt: '2026-09-06T00:00:00.000Z',
    });

    const response = await request(app).get('/api/robots/image-moderation-status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'unavailable',
      changedAt: '2026-09-06T00:00:00.000Z',
    });
    expect(mockGetAvailability).toHaveBeenCalledTimes(1);
  });
});
