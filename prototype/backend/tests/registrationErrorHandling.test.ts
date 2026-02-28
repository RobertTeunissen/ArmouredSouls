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

describe('Registration Error Handling', () => {
  let testUserIds: number[] = [];

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
      testUserIds = [];
    }
  });

  describe('Validation errors → 400 with specific message', () => {
    it('should return 400 with VALIDATION_ERROR code for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: '', email: '', password: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return specific error for short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'valid_email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username must be at least 3 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return specific error for invalid username characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'user name!', email: 'valid_email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username can only contain');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return specific error for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'validuser', email: 'valid_email', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password must be at least 8 characters');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Duplicate errors → 400 with specific message', () => {
    it('should return 400 with DUPLICATE_USERNAME code for existing username', async () => {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const username = `dup_${uniqueSuffix}`.substring(0, 20);
      const email1 = `em1_${uniqueSuffix}`.substring(0, 20);
      const email2 = `em2_${uniqueSuffix}`.substring(0, 20);

      // Register first user
      const first = await request(app)
        .post('/api/auth/register')
        .send({ username, email: email1, password: 'password123' });

      expect(first.status).toBe(201);
      testUserIds.push(first.body.user.id);

      // Attempt duplicate username
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username, email: email2, password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username is already taken');
      expect(response.body.code).toBe('DUPLICATE_USERNAME');
    });

    it('should return 400 with DUPLICATE_EMAIL code for existing email', async () => {
      const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const username1 = `us1_${uniqueSuffix}`.substring(0, 20);
      const username2 = `us2_${uniqueSuffix}`.substring(0, 20);
      const email = `eml_${uniqueSuffix}`.substring(0, 20);

      // Register first user
      const first = await request(app)
        .post('/api/auth/register')
        .send({ username: username1, email, password: 'password123' });

      expect(first.status).toBe(201);
      testUserIds.push(first.body.user.id);

      // Attempt duplicate email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: username2, email, password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is already registered');
      expect(response.body.code).toBe('DUPLICATE_EMAIL');
    });
  });

  describe('Error response format', () => {
    it('should return consistent JSON format with error and code fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: '', email: '', password: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.code).toBe('string');
    });

    it('should not expose internal details in error messages for validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', email: 'valid_email', password: 'password123' });

      expect(response.status).toBe(400);
      // Should not contain stack traces or internal info
      expect(response.body.error).not.toMatch(/at .+\.\w+:\d+/); // no stack trace lines
      expect(response.body.error).not.toContain('prisma');
    });
  });
});
