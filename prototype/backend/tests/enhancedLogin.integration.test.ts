import request from 'supertest';
import prisma from '../src/lib/prisma';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

/**
 * Integration tests for the enhanced POST /api/auth/login endpoint.
 * Validates: Requirements 11.8
 *
 * Covers:
 * - Login with username → 200 with token and user profile
 * - Login with email → 200 with token and user profile
 * - Login with non-existent identifier → 401
 * - Login with correct identifier but wrong password → 401
 * - Login with missing identifier → 400
 * - Login with missing password → 400
 * - Backward compatibility: login with 'username' field
 */
describe('Enhanced Login Endpoint Integration', () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const testUsername = `login_${suffix}`.substring(0, 20);
  const testEmail = `loge_${suffix}`.substring(0, 20);
  const testPassword = 'securePass1';
  let testUserId: number;

  beforeAll(async () => {
    await prisma.$connect();

    // Register a user to test login against
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, email: testEmail, password: testPassword });

    expect(response.status).toBe(201);
    testUserId = response.body.user.id;
  });

  afterAll(async () => {
    // Clean up the test user
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('Login with username', () => {
    it('should return 200 with token and user profile when logging in with username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testUsername, password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);

      const user = response.body.user;
      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.username).toBe(testUsername);
      expect(user.email).toBe(testEmail);
      expect(typeof user.currency).toBe('number');
      expect(typeof user.prestige).toBe('number');
      expect(typeof user.role).toBe('string');
      // Should not expose passwordHash
      expect(user).not.toHaveProperty('passwordHash');
    });
  });

  describe('Login with email', () => {
    it('should return 200 with token and user profile when logging in with email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testEmail, password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);

      const user = response.body.user;
      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.username).toBe(testUsername);
      expect(user.email).toBe(testEmail);
      expect(typeof user.currency).toBe('number');
      expect(typeof user.prestige).toBe('number');
      expect(typeof user.role).toBe('string');
    });
  });

  describe('Invalid credentials handling', () => {
    it('should return 401 with "Invalid credentials" for non-existent identifier', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'nonexistent_user_xyz', password: testPassword });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 with "Invalid credentials" for correct identifier but wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testUsername, password: 'wrongPassword123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 401 with "Invalid credentials" for correct email but wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testEmail, password: 'wrongPassword123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Missing fields handling', () => {
    it('should return 400 when identifier is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: testPassword });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testUsername });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when both fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Backward compatibility', () => {
    it('should accept login with "username" field instead of "identifier"', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: testUsername, password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');

      const user = response.body.user;
      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.username).toBe(testUsername);
    });
  });
});
