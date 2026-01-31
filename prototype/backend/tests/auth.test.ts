import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from '../src/routes/auth';
import userRoutes from '../src/routes/user';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

describe('Authentication Endpoints', () => {
  let testUser: any;
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = 'testpass123';

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create a test user similar to the seeded test users
    const passwordHash = await bcrypt.hash(testPassword, 10);
    testUser = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash,
        role: 'user',
        currency: 100000,
        prestige: 0,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      
      // Verify user data structure matches frontend expectations
      const { user } = response.body;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('currency');
      expect(user).toHaveProperty('prestige');
      
      // Verify no stableName field (removed from frontend interface)
      expect(user).not.toHaveProperty('stableName');
      
      // Verify correct values
      expect(user.username).toBe(testUsername);
      expect(user.role).toBe('user');
      expect(user.currency).toBe(100000);
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/user/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: testPassword,
        });
      
      authToken = loginResponse.body.token;
    });

    it('should return user profile with correct data structure', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Verify user data structure
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('role');
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('prestige');
      expect(response.body).toHaveProperty('createdAt');
      
      // Verify no stableName field
      expect(response.body).not.toHaveProperty('stableName');
      
      // Verify no sensitive data is returned
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Test User Compatibility', () => {
    it('should verify test user can login and access profile', async () => {
      // This test verifies that test users created by seed.ts
      // have the same structure and can login successfully
      
      // First check if test_user_001 exists (from seed data)
      const seedTestUser = await prisma.user.findUnique({
        where: { username: 'test_user_001' },
      });

      // Only run this test if seed data exists
      if (seedTestUser) {
        // Login with test user
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'test_user_001',
            password: 'testpass123',
          });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.body).toHaveProperty('token');
        
        // Get profile
        const profileResponse = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${loginResponse.body.token}`);

        expect(profileResponse.status).toBe(200);
        expect(profileResponse.body.username).toBe('test_user_001');
        expect(profileResponse.body.role).toBe('user');
        expect(profileResponse.body.currency).toBe(100000);
      } else {
        console.log('Skipping test_user_001 test - seed data not present');
      }
    });
  });
});
