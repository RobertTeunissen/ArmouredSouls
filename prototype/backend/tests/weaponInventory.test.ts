import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import weaponInventoryRoutes from '../src/routes/weaponInventory';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/weapon-inventory', weaponInventoryRoutes);

describe('Weapon Inventory Routes', () => {
  let testUser: any;
  let authToken: string;
  let testWeapon: any;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();

    // Get a weapon for testing (from seed data - weapons are global)
    testWeapon = await prisma.weapon.findFirst({
      where: { name: 'Practice Sword' },
    });

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testUser) {
      await deleteTestUser(testUser.id);
    }
    await prisma.$disconnect();
  });

  describe('GET /api/weapon-inventory', () => {
    it('should get user weapon inventory with auth', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify inventory item structure if any items exist
      if (response.body.length > 0) {
        const item = response.body[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('weaponId');
        expect(item).toHaveProperty('weapon');
        expect(item.weapon).toHaveProperty('name');
      }
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/weapon-inventory/purchase', () => {
    it('should return 400 without weapon ID', async () => {
      const response = await request(app)
        .post('/api/weapon-inventory/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 with invalid weapon ID', async () => {
      const response = await request(app)
        .post('/api/weapon-inventory/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ weaponId: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 with non-existent weapon ID', async () => {
      const response = await request(app)
        .post('/api/weapon-inventory/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ weaponId: 99999 });

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/weapon-inventory/purchase')
        .send({ weaponId: testWeapon?.id || 1 });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/weapon-inventory/storage-status', () => {
    it('should get storage status with auth', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory/storage-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('currentWeapons');
      expect(response.body).toHaveProperty('maxCapacity');
      expect(response.body).toHaveProperty('isFull');
      expect(typeof response.body.currentWeapons).toBe('number');
      expect(typeof response.body.maxCapacity).toBe('number');
      expect(typeof response.body.isFull).toBe('boolean');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory/storage-status');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/weapon-inventory/:id/available', () => {
    it('should return 404 for non-existent inventory item', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory/99999/available')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/weapon-inventory/1/available');

      expect(response.status).toBe(401);
    });
  });
});
