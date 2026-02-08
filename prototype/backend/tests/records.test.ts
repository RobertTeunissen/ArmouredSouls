import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recordsRoutes from '../src/routes/records';

dotenv.config();

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/records', recordsRoutes);

describe('Records Routes', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/records', () => {
    it('should get all hall of records statistics', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should have combat records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('combat');
      
      const combatRecords = response.body.combat;
      expect(combatRecords).toHaveProperty('fastestVictory');
      expect(combatRecords).toHaveProperty('longestBattle');
      expect(combatRecords).toHaveProperty('mostDamageInBattle');
    });

    it('should have career records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('career');
      
      const careerRecords = response.body.career;
      expect(careerRecords).toHaveProperty('highestElo');
      expect(careerRecords).toHaveProperty('highestWinRate');
      expect(careerRecords).toHaveProperty('mostBattles');
      expect(careerRecords).toHaveProperty('mostKills');
      expect(careerRecords).toHaveProperty('mostLifetimeDamage');
    });

    it('should have economic records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('economic');
      
      const economicRecords = response.body.economic;
      expect(economicRecords).toHaveProperty('highestFame');
      expect(economicRecords).toHaveProperty('richestStables');
    });

    it('should have prestige records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('prestige');
      
      const prestigeRecords = response.body.prestige;
      expect(prestigeRecords).toHaveProperty('highestPrestige');
    });

    it('should have upsets section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('upsets');
      
      const upsets = response.body.upsets;
      expect(upsets).toHaveProperty('biggestUpset');
      expect(upsets).toHaveProperty('biggestEloGain');
      expect(upsets).toHaveProperty('biggestEloLoss');
    });

    it('should handle empty database gracefully', async () => {
      const response = await request(app)
        .get('/api/records');

      // Should not crash even with minimal data
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should return records with proper structure', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      
      // Verify overall structure
      expect(typeof response.body).toBe('object');
      expect(Object.keys(response.body).length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
