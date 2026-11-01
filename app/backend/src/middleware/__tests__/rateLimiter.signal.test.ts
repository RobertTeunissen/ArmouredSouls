/**
 * The IP-keyed limiters (login, registration, general API) record a
 * `rate_limit` security signal on every refusal and keep the default 429.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import request from 'supertest';

const mockTrackAnonymous = jest.fn();
jest.mock('../../services/security/securityMonitor', () => ({
  securityMonitor: { trackAnonymousRateLimit: (...a: unknown[]) => mockTrackAnonymous(...a) },
}));

import { createLoginLimiter } from '../rateLimiter';
import type { EnvConfig } from '../../config/env';

const config = { loginRateLimitWindowMs: 60_000, loginRateLimitMax: 2 } as unknown as EnvConfig;

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use('/api/auth/login', createLoginLimiter(config));
  app.post('/api/auth/login', (_req, res) => { res.status(401).json({ error: 'Invalid credentials' }); });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it('records a signal only once the limit is hit, and still answers 429', async () => {
  expect((await request(baseUrl).post('/api/auth/login')).status).toBe(401);
  expect((await request(baseUrl).post('/api/auth/login')).status).toBe(401);
  expect(mockTrackAnonymous).not.toHaveBeenCalled();

  const refused = await request(baseUrl).post('/api/auth/login?next=/x');
  expect(refused.status).toBe(429);
  expect(mockTrackAnonymous).toHaveBeenCalledTimes(1);
  expect(mockTrackAnonymous).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1'), '/api/auth/login?next=/x');
});
