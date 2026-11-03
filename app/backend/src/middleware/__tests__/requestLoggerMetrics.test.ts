/**
 * requestLogger hands every finished request to the request metrics (admin
 * System page) with the route pattern and the error code errorHandler left.
 */
import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';

const mockRecordRequest = jest.fn();
jest.mock('../../services/monitoring/requestMetrics', () => ({
  recordRequest: (...args: unknown[]) => mockRecordRequest(...args),
  routePattern: (req: { baseUrl: string; route?: { path: string } }) => (req.route ? `${req.baseUrl}${req.route.path}` : null),
}));
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { requestLogger } from '../requestLogger';

type FakeResponse = EventEmitter & { statusCode: number; locals?: Record<string, unknown> };

function finish(res: FakeResponse, req: Partial<Request>): void {
  const next: NextFunction = jest.fn();
  requestLogger(req as Request, res as unknown as Response, next);
  expect(next).toHaveBeenCalled();
  res.emit('finish');
}

describe('requestLogger → request metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports the route pattern, status and the error code errorHandler set', () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 500, locals: { errorCode: 'STATEMENT_TIMEOUT' } });
    finish(res, { method: 'GET', originalUrl: '/api/admin/users/42?x=1', baseUrl: '/api/admin/users', route: { path: '/:id' } });

    expect(mockRecordRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET', route: '/api/admin/users/:id', statusCode: 500, errorCode: 'STATEMENT_TIMEOUT',
    }));
  });

  it('reports no error code when none was set, and copes without res.locals', () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    finish(res, { method: 'GET', originalUrl: '/api/robots', baseUrl: '', route: undefined });

    expect(mockRecordRequest).toHaveBeenCalledWith(expect.objectContaining({ route: null, statusCode: 200, errorCode: null }));
  });
});
