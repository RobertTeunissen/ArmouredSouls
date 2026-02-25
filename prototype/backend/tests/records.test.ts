import request from 'supertest';
import prisma from '../src/lib/prisma';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recordsRoutes from '../src/routes/records';

dotenv.config();


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
      
      // Verify arrays
      expect(Array.isArray(combatRecords.fastestVictory)).toBe(true);
      expect(Array.isArray(combatRecords.longestBattle)).toBe(true);
      expect(Array.isArray(combatRecords.mostDamageInBattle)).toBe(true);
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
      
      // Verify arrays
      expect(Array.isArray(careerRecords.highestElo)).toBe(true);
      expect(Array.isArray(careerRecords.highestWinRate)).toBe(true);
      expect(Array.isArray(careerRecords.mostBattles)).toBe(true);
      expect(Array.isArray(careerRecords.mostKills)).toBe(true);
      expect(Array.isArray(careerRecords.mostLifetimeDamage)).toBe(true);
    });

    it('should have economic records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('economic');
      
      const economicRecords = response.body.economic;
      expect(economicRecords).toHaveProperty('highestFame');
      expect(economicRecords).toHaveProperty('richestStables');
      
      // Verify arrays
      expect(Array.isArray(economicRecords.highestFame)).toBe(true);
      expect(Array.isArray(economicRecords.richestStables)).toBe(true);
    });

    it('should have prestige records section', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('prestige');
      
      const prestigeRecords = response.body.prestige;
      expect(prestigeRecords).toHaveProperty('highestPrestige');
      
      // Verify arrays
      expect(Array.isArray(prestigeRecords.highestPrestige)).toBe(true);
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
      
      // Verify arrays
      expect(Array.isArray(upsets.biggestUpset)).toBe(true);
      expect(Array.isArray(upsets.biggestEloGain)).toBe(true);
      expect(Array.isArray(upsets.biggestEloLoss)).toBe(true);
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

    it('should return up to 10 records per category', async () => {
      const response = await request(app)
        .get('/api/records');

      expect(response.status).toBe(200);
      
      // Check that arrays don't exceed 10 items
      const { combat, upsets, career, economic, prestige } = response.body;
      
      expect(combat.fastestVictory.length).toBeLessThanOrEqual(10);
      expect(combat.longestBattle.length).toBeLessThanOrEqual(10);
      expect(combat.mostDamageInBattle.length).toBeLessThanOrEqual(10);
      expect(combat.narrowestVictory.length).toBeLessThanOrEqual(10);
      
      expect(upsets.biggestUpset.length).toBeLessThanOrEqual(10);
      expect(upsets.biggestEloGain.length).toBeLessThanOrEqual(10);
      expect(upsets.biggestEloLoss.length).toBeLessThanOrEqual(10);
      
      expect(career.mostBattles.length).toBeLessThanOrEqual(10);
      expect(career.highestWinRate.length).toBeLessThanOrEqual(10);
      expect(career.mostLifetimeDamage.length).toBeLessThanOrEqual(10);
      expect(career.highestElo.length).toBeLessThanOrEqual(10);
      expect(career.mostKills.length).toBeLessThanOrEqual(10);
      
      expect(Array.isArray(economic.highestFame)).toBe(true);
      expect(economic.highestFame.length).toBeLessThanOrEqual(10);
      expect(Array.isArray(economic.richestStables)).toBe(true);
      expect(economic.richestStables.length).toBeLessThanOrEqual(10);
      
      expect(Array.isArray(prestige.highestPrestige)).toBe(true);
      expect(prestige.highestPrestige.length).toBeLessThanOrEqual(10);
      expect(Array.isArray(prestige.mostTitles)).toBe(true);
      expect(prestige.mostTitles.length).toBeLessThanOrEqual(10);
    });
  });
});
