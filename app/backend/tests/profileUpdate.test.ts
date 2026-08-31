import request from 'supertest';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import userRoutes from '../src/routes/user';
import { errorHandler } from '../src/middleware/errorHandler';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

describe('Profile Update Endpoint', () => {
  const testUserIds: number[] = [];
  let testUser: any;
  let authToken: string;
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = 'TestPass123';

  /**
   * Sign a token against the user's *current* `tokenVersion`.
   *
   * authenticateToken compares the token's `tokenVersion` against the database row
   * and rejects a mismatch, which is how a password change invalidates existing
   * sessions. A token signed once in `beforeAll` therefore dies the moment any test
   * in this file changes the password, and every later test sees a 401 unrelated to
   * what it is asserting.
   */
  /**
   * Field → message from the standard error body.
   *
   * The shape is `details.fields`, an array of `{ field, message }`, and `error`
   * carries the joined messages. These assertions used to read `details.stableName`
   * — a fourth shape nothing produced. See the note in `src/routes/user.ts`.
   */
  function fieldErrors(body: {
    details?: { fields?: Array<{ field: string; message: string }> };
  }): Record<string, string> {
    return Object.fromEntries((body.details?.fields ?? []).map((f) => [f.field, f.message]));
  }

  async function signTokenForUser(userId: number): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      JWT_SECRET,
    );
  }

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create a test user
    const passwordHash = await bcrypt.hash(testPassword, 10);
    testUser = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash,
        role: 'user',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserIds.push(testUser.id);

    authToken = await signTokenForUser(testUser.id);
  });

  afterEach(async () => {
    // Cleanup after each test in correct dependency order
    if (testUserIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: testUserIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);

      if (robotIds.length > 0) {
        // Combatants live in battle_participants since Spec #43 dropped
        // battles.robot1_id/robot2_id. Participants and summaries cascade with
        // the battle, so deleting the battle is enough.
        await prisma.battle.deleteMany({
          where: { participants: { some: { robotId: { in: robotIds } } } },
        });
      }

      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.facility.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.robot.deleteMany({
        where: { userId: { in: testUserIds } },
      });
    }
  });

  afterAll(async () => {
    // Final cleanup of users
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  describe('PUT /api/user/profile', () => {
    it('should update stable name successfully', async () => {
      const newStableName = `TestStable_${Date.now()}`;
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: newStableName });

      expect(response.status).toBe(200);
      expect(response.body.stableName).toBe(newStableName);
      
      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.stableName).toBe(newStableName);
    });

    it('should update profile visibility successfully', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ profileVisibility: 'private' });

      expect(response.status).toBe(200);
      expect(response.body.profileVisibility).toBe('private');
    });

    it('should update notification preferences successfully', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notificationsBattle: false,
          notificationsLeague: false,
        });

      expect(response.status).toBe(200);
      expect(response.body.notificationsBattle).toBe(false);
      expect(response.body.notificationsLeague).toBe(false);
    });

    it('should update theme preference successfully', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ themePreference: 'light' });

      expect(response.status).toBe(200);
      expect(response.body.themePreference).toBe('light');
    });

    it('should update multiple fields at once', async () => {
      const newStableName = `MultiUpdate_${Date.now()}`;
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stableName: newStableName,
          profileVisibility: 'public',
          themePreference: 'auto',
          notificationsBattle: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.stableName).toBe(newStableName);
      expect(response.body.profileVisibility).toBe('public');
      expect(response.body.themePreference).toBe('auto');
      expect(response.body.notificationsBattle).toBe(true);
    });

    it('should change password successfully with correct current password', async () => {
      const newPassword = 'NewPass456';
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: newPassword,
        });

      expect(response.status).toBe(200);
      
      // Verify new password works
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      const validPassword = await bcrypt.compare(newPassword, updatedUser!.passwordHash);
      expect(validPassword).toBe(true);
      
      // Change password back for other tests
      await prisma.user.update({
        where: { id: testUser.id },
        data: { passwordHash: await bcrypt.hash(testPassword, 10) },
      });

      // The successful change above bumped `tokenVersion`, so `authToken` is now
      // rejected. Re-issue it the way a real client would after re-authenticating.
      authToken = await signTokenForUser(testUser.id);
    });

    it('should reject password change with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPass456',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should reject password change without current password', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newPassword: 'NewPass456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is required to change password');
      expect(fieldErrors(response.body).currentPassword).toBeDefined();
    });

    it('should reject stable name that is too short', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: 'ab' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 3 characters');
      expect(fieldErrors(response.body).stableName).toContain('at least 3 characters');
    });

    it('should reject stable name that is too long', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: 'a'.repeat(31) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('30 characters or less');
      expect(fieldErrors(response.body).stableName).toContain('30 characters or less');
    });

    it('should reject stable name with invalid characters', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: 'Test@Name!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('only contain');
      expect(fieldErrors(response.body).stableName).toContain('only contain');
    });

    it('should reject stable name with profanity', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: 'BadShitName' });

      // Profanity is a content rule, checked in the handler rather than in the Zod
      // schema, so this is the one stableName case that reaches the second layer.
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('inappropriate content');
      expect(fieldErrors(response.body).stableName).toContain('inappropriate content');
    });

    it('should reject duplicate stable name', async () => {
      // Create another user with a stable name
      const otherUser = await prisma.user.create({
        data: {
          username: `otheruser_${Date.now()}`,
          passwordHash: await bcrypt.hash('password123', 10),
          role: 'user',
          currency: 10000,
          prestige: 100,
          stableName: 'TakenStableName',
        },
      });
      testUserIds.push(otherUser.id);

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stableName: 'TakenStableName' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already taken');
    });

    it('should reject weak password (too short)', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'Short1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 8 characters');
      expect(fieldErrors(response.body).newPassword).toContain('at least 8 characters');
    });

    it('should reject weak password (no uppercase)', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'nouppercase123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('uppercase letter');
      expect(fieldErrors(response.body).newPassword).toContain('uppercase letter');
    });

    it('should reject weak password (no lowercase)', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NOLOWERCASE123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('lowercase letter');
      expect(fieldErrors(response.body).newPassword).toContain('lowercase letter');
    });

    it('should reject weak password (no number)', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NoNumberPass',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('number');
      expect(fieldErrors(response.body).newPassword).toContain('number');
    });

    it('should reject invalid profile visibility value', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ profileVisibility: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Profile visibility must be 'public' or 'private'");
      expect(fieldErrors(response.body).profileVisibility).toBeDefined();
    });

    it('should reject invalid theme preference value', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ themePreference: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Theme must be 'dark', 'light', or 'auto'");
      expect(fieldErrors(response.body).themePreference).toBeDefined();
    });

    it('should reject request without authentication token', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .send({ stableName: 'TestName' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject request with invalid authentication token', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token')
        .send({ stableName: 'TestName' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should preserve unchanged fields when updating partial data', async () => {
      // First, set some initial values
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          stableName: 'InitialName',
          profileVisibility: 'public',
          notificationsBattle: true,
          notificationsLeague: true,
          themePreference: 'dark',
        },
      });

      // Update only one field
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ themePreference: 'light' });

      expect(response.status).toBe(200);
      
      // Verify only theme changed, others preserved
      expect(response.body.themePreference).toBe('light');
      expect(response.body.stableName).toBe('InitialName');
      expect(response.body.profileVisibility).toBe('public');
      expect(response.body.notificationsBattle).toBe(true);
      expect(response.body.notificationsLeague).toBe(true);
    });

    it('should return all profile fields in response', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ themePreference: 'dark' });

      expect(response.status).toBe(200);
      
      // Verify core user fields are present
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('prestige');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('stableName');
      expect(response.body).toHaveProperty('profileVisibility');
      expect(response.body).toHaveProperty('notificationsBattle');
      expect(response.body).toHaveProperty('notificationsLeague');
      
      // Note: Battle statistics are not included in profile update response
      // They would be fetched separately via analytics endpoints
    });

    /**
     * **Validates: Requirements 4.2**
     * Test that new users have default visibility set to public
     */
    it('should have default visibility set to public for new users', async () => {
      // Create a new user without specifying profileVisibility
      const newUser = await prisma.user.create({
        data: {
          username: `newuser_${Date.now()}`,
          passwordHash: await bcrypt.hash('TestPass123', 10),
          role: 'user',
        },
      });
      testUserIds.push(newUser.id);

      // Generate auth token for new user
      const newUserToken = jwt.sign(
        { userId: newUser.id, username: newUser.username, role: newUser.role },
        JWT_SECRET
      );

      // Fetch profile to check default visibility
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.profileVisibility).toBe('public');
    });

    /**
     * **Validates: Requirements 6.4 (Property 7)**
     * Test that invalid data returns 400 with validation errors
     */
    it('should return 400 with validation errors for multiple invalid fields', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stableName: 'ab', // Too short
          profileVisibility: 'invalid', // Invalid value
          themePreference: 'neon', // Invalid value
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toBeDefined();

      // Every failing field is named, and `error` repeats their messages so a client
      // that only reads the string still shows something useful.
      const errors = fieldErrors(response.body);
      expect(errors.stableName).toBeDefined();
      expect(errors.profileVisibility).toBeDefined();
      expect(errors.themePreference).toBeDefined();
      expect(response.body.error).toContain(errors.stableName);
    });
  });
});
