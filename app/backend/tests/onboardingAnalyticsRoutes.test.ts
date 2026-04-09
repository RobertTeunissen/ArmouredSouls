/**
 * Tests for onboarding analytics routes
 * Verifies admin-only access to analytics summary endpoint
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import onboardingAnalyticsRouter from '../src/routes/onboardingAnalytics';

const app = express();
app.use(express.json());
app.use('/api/onboarding/analytics', onboardingAnalyticsRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Onboarding Analytics Routes', () => {
  describe('GET /api/onboarding/analytics/summary', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/onboarding/analytics/summary');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should return 403 when non-admin user tries to access', async () => {
      // Create token for regular user
      const token = jwt.sign(
        { userId: 1, username: 'testuser', role: 'player' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/onboarding/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should return 200 when admin user accesses', async () => {
      // Create token for admin user
      const token = jwt.sign(
        { userId: 1, username: 'admin', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/onboarding/analytics/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('totalEvents');
      expect(response.body.data).toHaveProperty('uniqueUsers');
      expect(response.body.data).toHaveProperty('completions');
      expect(response.body.data).toHaveProperty('skips');
      expect(response.body.data).toHaveProperty('stepCompletionCounts');
    });
  });

  describe('POST /api/onboarding/analytics', () => {
    it('should allow authenticated users to post events', async () => {
      // Regular users should be able to post their own analytics events
      const token = jwt.sign(
        { userId: 1, username: 'testuser', role: 'player' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

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
