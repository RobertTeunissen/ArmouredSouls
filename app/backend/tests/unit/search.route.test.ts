const mockSearch = jest.fn();
const mockRecordExecutedSearch = jest.fn();
const mockRecordTelemetryFailure = jest.fn();
const mockGetActiveSearchSeasonContext = jest.fn();

jest.mock('../../src/services/search/searchAnalyticsService', () => ({
  __esModule: true,
  getActiveSearchSeasonContext: mockGetActiveSearchSeasonContext,
  searchAnalyticsService: {
    recordExecutedSearch: mockRecordExecutedSearch,
    recordTelemetryFailure: mockRecordTelemetryFailure,
  },
}));

jest.mock('../../src/services/search/searchService', () => ({
  __esModule: true,
  default: { search: mockSearch },
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../src/services/security/securityMonitor', () => ({
  securityMonitor: {
    trackRateLimitViolation: jest.fn(),
    logValidationFailure: jest.fn(),
    logAuthorizationFailure: jest.fn(),
    setStableName: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const JWT_SECRET = 'test-secret-key-for-jwt-signing-1234567890';
jest.mock('../../src/config/env', () => ({
  getConfig: () => ({ jwtSecret: 'test-secret-key-for-jwt-signing-1234567890', nodeEnv: 'test' }),
}));

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import searchRouter from '../../src/routes/search';
import { errorHandler } from '../../src/middleware/errorHandler';

const SEARCH_RESPONSE = {
  robots: [{ category: 'robots', id: 3, label: 'Search Bot' }],
  stables: [],
  guide: [],
};

function createApp(): express.Express {
  const app = express();
  app.use('/api/search', searchRouter);
  app.use(errorHandler);
  return app;
}

function authToken(): string {
  return jwt.sign(
    { userId: 7, username: 'tester', role: 'user', tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('GET /api/search', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      tokenVersion: 0,
      stableName: 'Test Stable',
      role: 'user',
    });
    mockSearch.mockResolvedValue(SEARCH_RESPONSE);
    mockGetActiveSearchSeasonContext.mockResolvedValue({ seasonNumber: 4, cycleNumber: 12 });
    mockRecordExecutedSearch.mockImplementation(async ({ response }) => ({
      response,
      attempted: true,
      persisted: true,
      limitation: null,
    }));
    mockRecordTelemetryFailure.mockImplementation(() => undefined);
    app = createApp();
  });

  it('rejects unauthenticated requests before invoking the search service', async () => {
    const response = await request(app).get('/api/search?q=bot');

    expect(response.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('trims and delegates the validated query, returning the grouped response', async () => {
    const response = await request(app)
      .get('/api/search?q=%20bot%20')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(SEARCH_RESPONSE);
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('bot');
    expect(mockGetActiveSearchSeasonContext).toHaveBeenCalledTimes(1);
    expect(mockRecordExecutedSearch).toHaveBeenCalledWith({
      response: SEARCH_RESPONSE,
      normalizedPhrase: 'bot',
      activeSeasonContext: { seasonNumber: 4, cycleNumber: 12 },
      userId: 7,
    });
  });

  it('returns the successful search response when season context lookup fails', async () => {
    mockGetActiveSearchSeasonContext.mockRejectedValueOnce(new Error('season service unavailable'));

    const response = await request(app)
      .get('/api/search?q=bot')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(SEARCH_RESPONSE);
    expect(mockRecordExecutedSearch).not.toHaveBeenCalled();
    expect(mockRecordTelemetryFailure).toHaveBeenCalledWith({
      response: SEARCH_RESPONSE,
      userId: 7,
    });
  });
  it('does not attempt analytics for a valid short query', async () => {
    const response = await request(app)
      .get('/api/search?q=a')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(SEARCH_RESPONSE);
    expect(mockSearch).toHaveBeenCalledWith('a');
    expect(mockGetActiveSearchSeasonContext).not.toHaveBeenCalled();
    expect(mockRecordExecutedSearch).not.toHaveBeenCalled();
  });

  it('does not attempt analytics when grouped search fails', async () => {
    mockSearch.mockRejectedValueOnce(new Error('source failure'));

    const response = await request(app)
      .get('/api/search?q=bot')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(500);
    expect(mockGetActiveSearchSeasonContext).not.toHaveBeenCalled();
    expect(mockRecordExecutedSearch).not.toHaveBeenCalled();
  });

  it('rejects unknown query fields without invoking the search service', async () => {
    const response = await request(app)
      .get('/api/search?q=bot&ownerId=7')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('rejects repeated query values without invoking the search service', async () => {
    const response = await request(app)
      .get('/api/search?q=bot&q=robot')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
