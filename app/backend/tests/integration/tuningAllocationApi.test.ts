/**
 * Integration tests for the Tuning Allocation API endpoints.
 *
 * GET  /api/robots/:id/tuning-allocation
 * PUT  /api/robots/:id/tuning-allocation
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4
 */

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma';
import tuningAllocationRoutes from '../../src/routes/tuningAllocation';
import { errorHandler } from '../../src/middleware/errorHandler';
import { getConfig } from '../../src/config/env';

dotenv.config();

// Create test app with tuning allocation routes + error handler
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/robots', tuningAllocationRoutes);
app.use(errorHandler);

// ── Helpers ──────────────────────────────────────────────────────────

function generateToken(userId: number, username: string): string {
  const config = getConfig();
  return jwt.sign(
    { userId, username, role: 'user', tokenVersion: 0 },
    config.jwtSecret,
    { expiresIn: '1h' },
  );
}

// ── Test Suite ───────────────────────────────────────────────────────

describe('Tuning Allocation API', () => {
  let ownerUser: any;
  let otherUser: any;
  let testRobot: any;
  let ownerToken: string;
  let otherToken: string;

  const userIds: number[] = [];
  const robotIds: number[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    // Create owner user
    ownerUser = await prisma.user.create({
      data: {
        username: `tuning_owner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        passwordHash: 'test_hash',
        currency: 10_000_000,
        tokenVersion: 0,
      },
    });
    userIds.push(ownerUser.id);
    ownerToken = generateToken(ownerUser.id, ownerUser.username);

    // Create non-owner user
    otherUser = await prisma.user.create({
      data: {
        username: `tuning_other_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        passwordHash: 'test_hash',
        currency: 10_000_000,
        tokenVersion: 0,
      },
    });
    userIds.push(otherUser.id);
    otherToken = generateToken(otherUser.id, otherUser.username);

    // Create test robot owned by ownerUser (all attributes at 5)
    testRobot = await prisma.robot.create({
      data: {
        userId: ownerUser.id,
        name: `TuningTestBot_${Date.now()}`,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        combatPower: 5,
        targetingSystems: 5,
        criticalSystems: 5,
        penetration: 5,
        weaponControl: 5,
        attackSpeed: 5,
        armorPlating: 5,
        shieldCapacity: 5,
        evasionThrusters: 5,
        damageDampeners: 5,
        counterProtocols: 5,
        hullIntegrity: 5,
        servoMotors: 5,
        gyroStabilizers: 5,
        hydraulicSystems: 5,
        powerCore: 5,
        combatAlgorithms: 5,
        threatAnalysis: 5,
        adaptiveAI: 5,
        logicCores: 5,
        syncProtocols: 5,
        supportSystems: 5,
        formationTactics: 5,
      },
    });
    robotIds.push(testRobot.id);
  });

  afterAll(async () => {
    // Clean up tuning allocations
    if (robotIds.length > 0) {
      await prisma.tuningAllocation.deleteMany({
        where: { robotId: { in: robotIds } },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: robotIds } },
      });
    }
    if (userIds.length > 0) {
      await prisma.facility.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await prisma.$disconnect();
  });

  // Reset tuning allocation between tests to avoid state leakage
  afterEach(async () => {
    await prisma.tuningAllocation.deleteMany({
      where: { robotId: testRobot.id },
    });
    // Remove any facilities created during tests
    await prisma.facility.deleteMany({
      where: { userId: ownerUser.id },
    });
  });

  // ── GET tests ────────────────────────────────────────────────────

  describe('GET /api/robots/:id/tuning-allocation', () => {
    it('should return correct state with base pool of 10 for players without facility', async () => {
      const res = await request(app)
        .get(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.robotId).toBe(testRobot.id);
      expect(res.body.facilityLevel).toBe(0);
      expect(res.body.poolSize).toBe(10);
      expect(res.body.allocated).toBe(0);
      expect(res.body.remaining).toBe(10);
      expect(res.body.allocations).toEqual({});
      expect(res.body.perAttributeMaxes).toBeDefined();
      // With no academy (cap 10) and base 5: max = 10 + 5 - 5 = 10
      expect(res.body.perAttributeMaxes.combatPower).toBe(10);
    });

    it('should reflect facility level in pool size', async () => {
      // Create a tuning_bay facility at level 3
      await prisma.facility.create({
        data: {
          userId: ownerUser.id,
          facilityType: 'tuning_bay',
          level: 3,
        },
      });

      const res = await request(app)
        .get(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.facilityLevel).toBe(3);
      // poolSize = (3 + 1) * 10 = 40
      expect(res.body.poolSize).toBe(40);
      expect(res.body.remaining).toBe(40);
    });
  });

  // ── PUT tests ────────────────────────────────────────────────────

  describe('PUT /api/robots/:id/tuning-allocation', () => {
    it('should save and return updated state', async () => {
      const allocations = { combatPower: 3, armorPlating: 2.5, attackSpeed: 1.5 };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(allocations);

      expect(res.status).toBe(200);
      expect(res.body.robotId).toBe(testRobot.id);
      expect(res.body.allocated).toBe(7);
      expect(res.body.remaining).toBe(3);
      expect(res.body.allocations.combatPower).toBe(3);
      expect(res.body.allocations.armorPlating).toBe(2.5);
      expect(res.body.allocations.attackSpeed).toBe(1.5);

      // Verify persistence via GET
      const getRes = await request(app)
        .get(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.allocated).toBe(7);
      expect(getRes.body.allocations.combatPower).toBe(3);
    });

    it('should reject over-budget allocation (sum > poolSize)', async () => {
      // No facility → poolSize = 10. Try to allocate 11.01 total.
      const allocations = { combatPower: 6, armorPlating: 5.01 };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(allocations);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toMatch(/exceeds pool size/i);
    });

    it('should reject per-attribute max exceeded (academyCap + 5)', async () => {
      // No academy → cap = 10, base = 5, max tuning = 10 + 5 - 5 = 10
      // Allocate 10.01 to a single attribute (exceeds per-attribute max)
      const allocations = { combatPower: 10.01 };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(allocations);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toMatch(/exceeds per-attribute max/i);
    });

    it('should reject non-owner with generic 403', async () => {
      const allocations = { combatPower: 1 };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(allocations);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.error).toBe('Access denied');
    });

    it('should reject invalid attribute names via Zod validation', async () => {
      // Unknown keys are stripped by the schema transform.
      // Sending only invalid keys results in an empty allocation (valid but no-op).
      // To test rejection, send a non-number value for a valid attribute name.
      const allocations = { combatPower: 'not-a-number' };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(allocations);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject values with > 2 decimal places', async () => {
      const allocations = { combatPower: 1.123 };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(allocations);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should strip unknown keys from the body', async () => {
      // Send valid allocation + unknown keys with numeric values
      // Unknown keys are stripped by the transform, only combatPower is saved
      const body = {
        combatPower: 2,
        unknownField: 999,
        anotherBogus: 42,
      };

      const res = await request(app)
        .put(`/api/robots/${testRobot.id}/tuning-allocation`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.allocated).toBe(2);
      expect(res.body.allocations.combatPower).toBe(2);
      expect(res.body.allocations.unknownField).toBeUndefined();
      expect(res.body.allocations.anotherBogus).toBeUndefined();
    });
  });
});
