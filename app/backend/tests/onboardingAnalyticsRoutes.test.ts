/**
 * Tests for the onboarding analytics route (signed-in players post their events).
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import onboardingAnalyticsRouter from '../src/routes/onboardingAnalytics';
import { errorHandler } from '../src/middleware/errorHandler';
import prisma from '../src/lib/prisma';
import { getConfig } from '../src/config/env';

const app = express();
app.use(express.json());
app.use('/api/onboarding/analytics', onboardingAnalyticsRouter);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

// Read from the memoised config the middleware verifies against, rather than
// guessing at `process.env` with a fallback that would silently produce 401s.
const JWT_SECRET = getConfig().jwtSecret;

/**
 * Tokens have to name a user that exists.
 *
 * `authenticateToken` reads the user row to check `tokenVersion` and, since roles
 * moved out of the JWT, to resolve `req.user.role`. This file signed tokens for a
 * hard-coded `userId: 1` and set `role` in the claim, so `requireAdmin` saw a role of
 * `undefined` on a user that was not there and every authenticated case 401'd — the
 * non-admin case included, which made its 403 assertion unreachable.
 */
describe('Onboarding Analytics Routes', () => {
  let playerUserId: number;

  const tokenFor = (userId: number, username: string, role: string): string =>
    jwt.sign({ userId, username, role, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '1h' });

  beforeAll(async () => {
    const player = await prisma.user.create({
      data: { username: `onb_player_${Date.now()}`, passwordHash: 'unused', role: 'player' },
    });
    playerUserId = player.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: playerUserId } });
  });

  describe('POST /api/onboarding/analytics', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app)
        .post('/api/onboarding/analytics')
        .send({ events: [{ eventType: 'step_started', timestamp: new Date().toISOString() }] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should allow authenticated users to post events', async () => {
      // Regular users should be able to post their own analytics events
      const token = tokenFor(playerUserId, 'testuser', 'player');

      const response = await request(app)
        .post('/api/onboarding/analytics')
        .set('Authorization', `Bearer ${token}`)
        .send({
          events: [
            {
              eventType: 'step_started',
              timestamp: new Date().toISOString(),
              step: 1,
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.received).toBe(1);
    });
  });
});
