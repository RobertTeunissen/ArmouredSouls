import request from 'supertest';
import prisma from '../src/lib/prisma';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import recordsRoutes from '../src/routes/records';
import { errorHandler } from '../src/middleware/errorHandler';
import { loadPlayerSets } from '../src/services/records/recordScope';
import {
  fetchCareerRecords,
  fetchCombatRecords,
  fetchPrestigeRecords,
  fetchUpsetRecords,
} from '../src/services/records/recordsQueryService';
import { createTestBattle, createTestRobot, createTestUser, deleteTestBattle, deleteTestUser } from './testHelpers';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/records', recordsRoutes);
app.use(errorHandler);

describe('Records Routes', () => {
  let userId: number;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    const user = await createTestUser();
    userId = user.id;
    authToken = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'test-secret');
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    await prisma.$disconnect();
  });

  it('refuses requests without a login', async () => {
    const response = await request(app).get('/api/records');
    expect(response.status).toBe(401);
  });

  describe('GET /api/records', () => {
    it('should get all hall of records statistics', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should have combat records section', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('combat');
      
      const combatRecords = response.body.combat;
      // Spec #46 R4.1/R4.2: fastestVictory and longestBattle removed
      expect(combatRecords).not.toHaveProperty('fastestVictory');
      expect(combatRecords).not.toHaveProperty('longestBattle');
      // Nov 2026: removed — most wins at exactly 1 HP, so every entry tied
      expect(combatRecords).not.toHaveProperty('narrowestVictory');
      expect(combatRecords).toHaveProperty('mostDamageInBattle');
      
      // Verify arrays
      // mostDamageInBattle is keyed by battle mode (Spec #46 R4.5)
      expect(Array.isArray(combatRecords.mostDamageInBattle)).toBe(false);
      expect(typeof combatRecords.mostDamageInBattle).toBe('object');
      expect(Array.isArray(combatRecords.mostDamageInBattle.league_1v1)).toBe(true);
    });

    it('should have career records section', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

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
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('economic');
      
      const economicRecords = response.body.economic;
      expect(economicRecords).toHaveProperty('highestFame');
      expect(economicRecords).toHaveProperty('richestStables');
      // Nov 2026: removed — it was always an empty list
      expect(economicRecords).not.toHaveProperty('mostExpensiveBattle');
      
      // Verify arrays
      expect(Array.isArray(economicRecords.highestFame)).toBe(true);
      expect(Array.isArray(economicRecords.richestStables)).toBe(true);
    });

    it('never ranks a generated bot stable as richest', async () => {
      const generated = await prisma.user.create({
        data: {
          username: `rich_bot_${Date.now().toString(36)}`, passwordHash: 'x',
          stableType: 'generated', isGenerated: true, currency: 2_000_000_000,
        },
      });
      try {
        const records = await (await import('../src/services/records/recordsQueryService')).fetchEconomicRecords();
        expect(records.richestStables.some((s) => s.userId === generated.id)).toBe(false);
        expect(records.richestStables.every((s) => s.stableType !== 'generated')).toBe(true);
      } finally {
        await prisma.user.delete({ where: { id: generated.id } });
      }
    });

    it('keeps only Most Decisive Victory among the team league records', async () => {
      const response = await request(app).get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      for (const size of ['2v2', '3v3']) {
        // Nov 2026: Fastest Victory, Longest Survival and Longest Non-Draw rank
        // capped or near-identical times; Most Damage Dealt duplicated the
        // per-mode Most Damage in One Battle.
        expect(Object.keys(response.body.teamBattle[size])).toEqual(['mostDecisiveVictory']);
      }
    });

    it('should have prestige records section', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('prestige');
      
      const prestigeRecords = response.body.prestige;
      expect(prestigeRecords).toHaveProperty('highestPrestige');
      
      // Verify arrays
      expect(Array.isArray(prestigeRecords.highestPrestige)).toBe(true);
    });

    it('should have upsets section', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('upsets');
      
      const upsets = response.body.upsets;
      expect(upsets).toHaveProperty('biggestUpset');
      expect(upsets).toHaveProperty('biggestTeamUpset');
      // Spec #46 R4.8: removed — ELO_K_FACTOR is fixed at 32
      expect(upsets).not.toHaveProperty('biggestEloGain');
      expect(upsets).not.toHaveProperty('biggestEloLoss');
      
      // Verify arrays
      expect(Array.isArray(upsets.biggestUpset)).toBe(true);
      expect(Array.isArray(upsets.biggestTeamUpset)).toBe(true);
    });

    it('should handle empty database gracefully', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      // Should not crash even with minimal data
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });

    it('should return records with proper structure', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Verify overall structure
      expect(typeof response.body).toBe('object');
      expect(Object.keys(response.body).length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return up to 10 records per category', async () => {
      const response = await request(app)
        .get('/api/records').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Check that arrays don't exceed 10 items
      const { combat, upsets, career, economic, prestige } = response.body;
      
      for (const entries of Object.values(combat.mostDamageInBattle)) {
        expect((entries as unknown[]).length).toBeLessThanOrEqual(10);
      }

      expect(upsets.biggestUpset.length).toBeLessThanOrEqual(10);
      expect(upsets.biggestTeamUpset.length).toBeLessThanOrEqual(10);
      
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

  describe('players filter (#595): players\' top 10, real places kept', () => {
    // Values far above anything else in the test database, so the fixture
    // robots and stables hold the top places: automaton first, the player second.
    const TOP = 2_000_000_000;
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    let automatonId: number;
    let generatedId: number;
    let automatonRobot: number;
    let playerRobot: number;
    const battleIds: number[] = [];

    beforeAll(async () => {
      automatonId = (await prisma.user.create({
        data: { username: `rec_auto_${stamp}`, passwordHash: 'x', stableType: 'automaton', prestige: TOP },
      })).id;
      generatedId = (await prisma.user.create({
        data: { username: `rec_gen_${stamp}`, passwordHash: 'x', stableType: 'generated', isGenerated: true, prestige: TOP - 2 },
      })).id;
      await prisma.user.update({ where: { id: userId }, data: { prestige: TOP - 1 } });

      automatonRobot = (await createTestRobot(automatonId, `RecAuto_${stamp}`)).id;
      playerRobot = (await createTestRobot(userId, `RecPlayer_${stamp}`)).id;
      const generatedRobot = (await createTestRobot(generatedId, `RecGen_${stamp}`)).id;
      await prisma.robot.update({ where: { id: automatonRobot }, data: { elo: TOP } });
      await prisma.robot.update({ where: { id: playerRobot }, data: { elo: TOP - 1 } });
      await prisma.robot.update({ where: { id: generatedRobot }, data: { elo: TOP - 2 } });

      // Most Damage (league 1v1): the automaton dealt the most, the player second.
      battleIds.push((await createTestBattle({
        robot1Id: automatonRobot, robot2Id: playerRobot, winnerId: automatonRobot, battleType: 'league_1v1',
        robot1DamageDealt: TOP, robot2DamageDealt: TOP - 1,
      })).id);
      // Biggest Upset: the automaton's upset is larger than the player's.
      battleIds.push((await createTestBattle({
        robot1Id: automatonRobot, robot2Id: playerRobot, winnerId: automatonRobot, battleType: 'tournament_1v1',
        robot1ELOBefore: 0, robot2ELOBefore: 1_000_000,
      })).id);
      battleIds.push((await createTestBattle({
        robot1Id: playerRobot, robot2Id: automatonRobot, winnerId: playerRobot, battleType: 'tournament_1v1',
        robot1ELOBefore: 0, robot2ELOBefore: 999_999,
      })).id);
    });

    afterAll(async () => {
      for (const id of battleIds) await deleteTestBattle(id);
      await deleteTestUser(automatonId);
      await deleteTestUser(generatedId);
    });

    it('lists only players\' entries, each with its place among every stable', async () => {
      const players = await loadPlayerSets();
      const [career, combat, upsets, prestige] = await Promise.all([
        fetchCareerRecords(players),
        fetchCombatRecords(players),
        fetchUpsetRecords(players),
        fetchPrestigeRecords(players),
      ]);

      expect(career.highestElo[0]).toMatchObject({ robotId: playerRobot, place: 2, stableType: 'human' });
      expect(career.highestElo.every((entry) => entry.stableType === 'human')).toBe(true);
      // The generated robot (place 3) is left out, so the next player is #4 or lower.
      expect(career.highestElo.slice(1).every((entry) => (entry.place ?? 0) >= 4)).toBe(true);

      expect(combat.mostDamageInBattle.league_1v1[0]).toMatchObject({
        damageDealt: TOP - 1, place: 2, robot: { id: playerRobot },
      });
      expect(upsets.biggestUpset[0]).toMatchObject({
        battleId: battleIds[2], eloDifference: 999_999, place: 2, underdog: { id: playerRobot },
      });
      expect(prestige.highestPrestige[0]).toMatchObject({ userId, place: 2 });
    });

    it('keeps every stable, without places, when not filtered', async () => {
      const career = await fetchCareerRecords();
      expect(career.highestElo.slice(0, 3).map((entry) => entry.robotId)).toEqual([automatonRobot, playerRobot, expect.any(Number)]);
      expect(career.highestElo.every((entry) => !('place' in entry))).toBe(true);
    });

    it('serves the players\' payload on ?stables=players', async () => {
      const response = await request(app)
        .get('/api/records').query({ stables: 'players' }).set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stables).toBe('players');
      expect(response.body.career.highestElo[0]).toMatchObject({ robotId: playerRobot, place: 2 });
    });

    it('rejects an unknown stables value', async () => {
      const response = await request(app)
        .get('/api/records').query({ stables: 'bots' }).set('Authorization', `Bearer ${authToken}`);
      expect(response.status).toBe(400);
    });
  });
});
