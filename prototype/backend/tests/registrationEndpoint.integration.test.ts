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
 * Integration tests for the POST /api/auth/register endpoint.
 * Validates: Requirements 11.7
 *
 * Covers:
 * - Complete registration flow with valid data
 * - Rejection of invalid inputs (missing fields, bad username/email/password)
 * - Duplicate username/email handling
 * - Error response format consistency
 */
describe('Registration Endpoint Integration', () => {
  const testUserIds: number[] = [];
  const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
      testUserIds.length = 0;
    }
  });

  describe('Complete registration flow with valid data', () => {
    it('should return 201 with token and user profile for valid registration', async () => {
      const username = `intg_${suffix}`.substring(0, 20);
      const email = `eig_${suffix}`.substring(0, 20);

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, email, password: 'securePass1' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);

      const user = response.body.user;
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(username);
      expect(user.email).toBe(email);
      expect(typeof user.currency).toBe('number');
      expect(typeof user.prestige).toBe('number');
      expect(typeof user.role).toBe('string');

      testUserIds.push(user.id);
    });

    it('should set correct default values for new accounts', async () => {
      const username = `def_${suffix}`.substring(0, 20);
      const email = `def_e_${suffix}`.substring(0, 20);

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, email, password: 'securePass1' });

      expect(response.status).toBe(201);
      const user = response.body.user;
      expect(user.currency).toBe(3000000);
      expect(user.prestige).toBe(0);
      expect(user.role).toBe('user');

      testUserIds.push(user.id);
    });

    it('should persist the user in the database', async () => {
      const username = `per_${suffix}`.substring(0, 20);
      const email = `per_e_${suffix}`.substring(0, 20);

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, email, password: 'securePass1' });

      expect(response.status).toBe(201);
      testUserIds.push(response.body.user.id);

      const dbUser = await prisma.user.findUnique({ where: { username } });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.username).toBe(username);
      expect(dbUser!.email).toBe(email);
    });
  });

  describe('Rejection of missing fields', () => {
    it('should return 400 when all fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'valid_email', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'valid_email' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rejection of invalid username', () => {
    it('should return 400 for username shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'valid_email', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username must be at least 3 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for username longer than 20 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a'.repeat(21), email: 'valid_email', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username must not exceed 20 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for username with invalid characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'user name!', email: 'valid_email', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username can only contain');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rejection of invalid email', () => {
    it('should return 400 for email shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'ab', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email must be at least 3 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for email longer than 20 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'a'.repeat(21), password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email must not exceed 20 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for email with invalid characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'bad email!', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Email can only contain');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rejection of invalid password', () => {
    it('should return 400 for password shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'valid_email', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password must be at least 8 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for password longer than 128 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'valid_email', password: 'a'.repeat(129) });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password must not exceed 128 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Duplicate username and email', () => {
    it('should return 400 with "Username is already taken" for duplicate username', async () => {
      const username = `dup_u_${suffix}`.substring(0, 20);
      const email1 = `du1_${suffix}`.substring(0, 20);
      const email2 = `du2_${suffix}`.substring(0, 20);

      const first = await request(app)
        .post('/api/auth/register')
        .send({ username, email: email1, password: 'securePass1' });

      expect(first.status).toBe(201);
      testUserIds.push(first.body.user.id);

      const second = await request(app)
        .post('/api/auth/register')
        .send({ username, email: email2, password: 'securePass1' });

      expect(second.status).toBe(400);
      expect(second.body.error).toBe('Username is already taken');
      expect(second.body.code).toBe('DUPLICATE_USERNAME');
    });

    it('should return 400 with "Email is already registered" for duplicate email', async () => {
      const username1 = `de1_${suffix}`.substring(0, 20);
      const username2 = `de2_${suffix}`.substring(0, 20);
      const email = `dup_e_${suffix}`.substring(0, 20);

      const first = await request(app)
        .post('/api/auth/register')
        .send({ username: username1, email, password: 'securePass1' });

      expect(first.status).toBe(201);
      testUserIds.push(first.body.user.id);

      const second = await request(app)
        .post('/api/auth/register')
        .send({ username: username2, email, password: 'securePass1' });

      expect(second.status).toBe(400);
      expect(second.body.error).toBe('Email is already registered');
      expect(second.body.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('Response format consistency', () => {
    it('should include error and code fields on all error responses', async () => {
      // Validation error
      const valRes = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'valid_email', password: 'securePass1' });

      expect(valRes.status).toBe(400);
      expect(typeof valRes.body.error).toBe('string');
      expect(typeof valRes.body.code).toBe('string');
      expect(valRes.body.error.length).toBeGreaterThan(0);
      expect(valRes.body.code.length).toBeGreaterThan(0);
    });

    it('should include token and user fields on success response', async () => {
      const username = `fmt_${suffix}`.substring(0, 20);
      const email = `fmt_e_${suffix}`.substring(0, 20);

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, email, password: 'securePass1' });

      expect(response.status).toBe(201);
      expect(typeof response.body.token).toBe('string');
      expect(response.body.user).toBeDefined();
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('username');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('currency');
      expect(response.body.user).toHaveProperty('prestige');
      expect(response.body.user).toHaveProperty('role');
      // Should not expose passwordHash
      expect(response.body.user).not.toHaveProperty('passwordHash');

      testUserIds.push(response.body.user.id);
    });

    it('should not expose internal details in error messages', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'valid_email', password: 'securePass1' });

      expect(response.status).toBe(400);
      expect(response.body.error).not.toMatch(/at .+\.\w+:\d+/);
      expect(response.body.error).not.toContain('prisma');
      expect(response.body.error).not.toContain('stack');
    });
  });
});
