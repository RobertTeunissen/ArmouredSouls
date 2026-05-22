import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import weaponInventoryRoutes from '../src/routes/weaponInventory';
import { errorHandler } from '../src/middleware/errorHandler';
import { createTestUser, deleteTestUser } from './testHelpers';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/weapon-inventory', weaponInventoryRoutes);
app.use(errorHandler);

describe('Weapon Inventory Routes', () => {
  let testUserIds: number[] = [];
  let testUser: any;
  let authToken: string;
  let testWeapon: any;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();
    testUserIds.push(testUser.id);

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
    if (testUserIds.length > 0) {
      for (const userId of testUserIds) {
        await deleteTestUser(userId);
      }
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

  // ─────────────────────────────────────────────────────────────────────
  // DELETE /api/weapon-inventory/:id — Resale (Spec #33)
  // ─────────────────────────────────────────────────────────────────────

  describe('DELETE /api/weapon-inventory/:id (resale)', () => {
    /** Helper: create a fresh user with a clean inventory and a JWT. */
    async function createResaleUser(opts: { workshopLevel?: number; currency?: number } = {}) {
      const user = await createTestUser();
      testUserIds.push(user.id);
      if (opts.currency !== undefined) {
        await prisma.user.update({ where: { id: user.id }, data: { currency: opts.currency } });
      }
      if (opts.workshopLevel !== undefined && opts.workshopLevel > 0) {
        await prisma.facility.upsert({
          where: { userId_facilityType: { userId: user.id, facilityType: 'weapons_workshop' } },
          create: { userId: user.id, facilityType: 'weapons_workshop', level: opts.workshopLevel },
          update: { level: opts.workshopLevel },
        });
      }
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'test-secret',
      );
      return { user, token };
    }

    /** Helper: insert a weapon into a user's inventory at a given pricePaid. */
    async function giveWeapon(userId: number, weaponId: number, pricePaid = 100_000) {
      return prisma.weaponInventory.create({
        data: { userId, weaponId, pricePaid },
      });
    }

    /** Helper: create a robot and equip a weapon to its main slot. */
    async function createRobotWithMainWeapon(userId: number, weaponInvId: number) {
      const robot = await prisma.robot.create({
        data: {
          name: `ResaleTest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          userId,
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
          mainWeaponId: weaponInvId,
        },
      });
      return robot;
    }

    it('returns 401 without authentication', async () => {
      const response = await request(app).delete('/api/weapon-inventory/1');
      expect(response.status).toBe(401);
    });

    it('returns 403 when selling another user\'s weapon', async () => {
      const ownerCtx = await createResaleUser();
      const otherCtx = await createResaleUser();
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ownerCtx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${otherCtx.token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 404 when inventory ID does not exist', async () => {
      const ctx = await createResaleUser();
      const response = await request(app)
        .delete('/api/weapon-inventory/9999999')
        .set('Authorization', `Bearer ${ctx.token}`);
      expect(response.status).toBe(403); // ownership check returns generic 403 (resource enumeration prevention)
    });

    it('returns 409 when weapon is equipped as main weapon', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);
      await createRobotWithMainWeapon(ctx.user.id, inv.id);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('code', 'WEAPON_EQUIPPED');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('robotName');

      // Inventory row not deleted
      const stillThere = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(stillThere).not.toBeNull();
    });

    it('returns 409 when weapon is equipped as offhand weapon', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);
      await prisma.robot.create({
        data: {
          name: `ResaleOffhand_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          userId: ctx.user.id,
          currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10,
          offhandWeaponId: inv.id,
        },
      });

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('code', 'WEAPON_EQUIPPED');
    });

    it('successful sale at Workshop L0 returns ₡0 and deletes the row', async () => {
      const ctx = await createResaleUser({ workshopLevel: 0, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(response.body.salePrice).toBe(0);
      expect(response.body.currency).toBe(0); // No credits gained at L0

      const deleted = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(deleted).toBeNull();
    });

    it('successful sale at Workshop L1 returns 10% of pricePaid', async () => {
      const ctx = await createResaleUser({ workshopLevel: 1, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(response.body.salePrice).toBe(10_000);
      expect(response.body.currency).toBe(10_000);
    });

    it('successful sale at Workshop L5 returns 50% of pricePaid', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(response.body.salePrice).toBe(50_000);
    });

    it('successful sale at Workshop L10 returns full pricePaid', async () => {
      const ctx = await createResaleUser({ workshopLevel: 10, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 425_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(response.body.salePrice).toBe(425_000);
      expect(response.body.currency).toBe(425_000);
    });

    it('starter weapon (pricePaid=0) returns ₡0 regardless of Workshop level', async () => {
      const ctx = await createResaleUser({ workshopLevel: 10, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 0);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(response.body.salePrice).toBe(0);

      const deleted = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(deleted).toBeNull();
    });

    it('writes a weapon_sale audit log row', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const before = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_sale' },
      });

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);
      expect(response.status).toBe(200);

      const after = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_sale' },
      });
      expect(after).toBe(before + 1);
    });

    it('defensive guard: negative pricePaid returns 500 and writes no audit row', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100);
      // Force a negative pricePaid (simulates migration tampering or future bug)
      await prisma.$executeRaw`UPDATE weapon_inventory SET price_paid = -1 WHERE id = ${inv.id}`;

      const before = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_sale' },
      });

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('code', 'INVALID_TRANSACTION');

      // No audit row written, inventory still present (transaction rolled back)
      const after = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_sale' },
      });
      expect(after).toBe(before);

      const stillThere = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(stillThere).not.toBeNull();
    });

    it('concurrent resale of the same weapon: exactly one succeeds', async () => {
      const ctx = await createResaleUser({ workshopLevel: 10, currency: 0 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      // Fire two parallel DELETE requests
      const [r1, r2] = await Promise.all([
        request(app).delete(`/api/weapon-inventory/${inv.id}`).set('Authorization', `Bearer ${ctx.token}`),
        request(app).delete(`/api/weapon-inventory/${inv.id}`).set('Authorization', `Bearer ${ctx.token}`),
      ]);

      const successCount = [r1, r2].filter((r) => r.status === 200).length;
      const notFoundCount = [r1, r2].filter((r) => r.status === 404 || r.status === 403).length;

      expect(successCount).toBe(1);
      expect(notFoundCount).toBe(1);

      // Currency increased by exactly one sale price, not two
      const after = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      expect(after!.currency).toBe(100_000);

      // Row deleted
      const deleted = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(deleted).toBeNull();
    });

    // ─── Achievement integration (Spec #33 R7.10–R7.11, Task 7.4) ────

    it('first sale unlocks E18 "Pawn Star"', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.achievementUnlocks)).toBe(true);
      const ids = response.body.achievementUnlocks.map((a: { id: string }) => a.id);
      expect(ids).toContain('E18');
    });

    it('10th sale unlocks E20 "Arms Dealer"', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();

      // Pre-seed 9 prior weapon_sale audit log rows for this user
      const cycleMeta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      const cycle = cycleMeta?.totalCycles ?? 1;
      const startSeq = (await prisma.auditLog.count({ where: { cycleNumber: cycle } })) + 1;
      for (let i = 0; i < 9; i++) {
        await prisma.auditLog.create({
          data: {
            cycleNumber: cycle,
            sequenceNumber: startSeq + i,
            eventType: 'weapon_sale',
            userId: ctx.user.id,
            payload: { weaponId: weapon!.id, salePrice: 100 },
          },
        });
      }

      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);
      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      const ids = response.body.achievementUnlocks.map((a: { id: string }) => a.id);
      expect(ids).toContain('E20');
    });

    it('sale at Workshop L10 unlocks E21 "Buy High, Sell Higher"', async () => {
      const ctx = await createResaleUser({ workshopLevel: 10 });
      const weapon = await prisma.weapon.findFirst();
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      const ids = response.body.achievementUnlocks.map((a: { id: string }) => a.id);
      expect(ids).toContain('E21');
    });

    it('cumulative ₡500K resale earnings unlocks E19 "Shrewd Negotiator"', async () => {
      const ctx = await createResaleUser({ workshopLevel: 5 });
      const weapon = await prisma.weapon.findFirst();

      // Pre-seed audit log rows summing to ₡499,000
      const cycleMeta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      const cycle = cycleMeta?.totalCycles ?? 1;
      const startSeq = (await prisma.auditLog.count({ where: { cycleNumber: cycle } })) + 1;
      await prisma.auditLog.create({
        data: {
          cycleNumber: cycle,
          sequenceNumber: startSeq,
          eventType: 'weapon_sale',
          userId: ctx.user.id,
          payload: { weaponId: weapon!.id, salePrice: 499_000 },
        },
      });

      // Sell one more weapon worth ≥ ₡1,000 to push total over the ₡500K threshold
      const inv = await giveWeapon(ctx.user.id, weapon!.id, 100_000);
      const response = await request(app)
        .delete(`/api/weapon-inventory/${inv.id}`)
        .set('Authorization', `Bearer ${ctx.token}`);

      expect(response.status).toBe(200);
      // L5 = 50%, ₡100K × 50% = ₡50K. Combined with ₡499K pre-seeded = ₡549K. ≥ ₡500K → unlock
      const ids = response.body.achievementUnlocks.map((a: { id: string }) => a.id);
      expect(ids).toContain('E19');
    });
  });
});
