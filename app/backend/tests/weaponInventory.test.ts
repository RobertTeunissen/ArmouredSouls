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

    it('returns 403 (generic ownership failure) when inventory ID does not exist — prevents enumeration', async () => {
      const ctx = await createResaleUser();
      const response = await request(app)
        .delete('/api/weapon-inventory/9999999')
        .set('Authorization', `Bearer ${ctx.token}`);
      // verifyWeaponOwnership returns a generic 403 for both "not found" and "owned by another user"
      // to prevent inventory ID enumeration. This is the same response another-user-weapon would get.
      expect(response.status).toBe(403);
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

  // ─────────────────────────────────────────────────────────────────────
  // POST /api/weapon-inventory/:id/refine — Refinement (Spec #34)
  // ─────────────────────────────────────────────────────────────────────

  describe('POST /api/weapon-inventory/:id/refine', () => {
    /** Create a fresh user with optional Workshop level + starting currency. */
    async function createRefineUser(opts: { workshopLevel?: number; currency?: number } = {}) {
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

    /** Insert a weapon into a user's inventory at a given pricePaid. */
    async function giveRefineWeapon(userId: number, weaponId: number, pricePaid = 100_000) {
      return prisma.weaponInventory.create({
        data: { userId, weaponId, pricePaid },
      });
    }

    it('returns 401 without auth', async () => {
      const response = await request(app)
        .post('/api/weapon-inventory/1/refine')
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });
      expect(response.status).toBe(401);
    });

    it('returns 403 when refining another user\'s weapon', async () => {
      const owner = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const intruder = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(owner.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${intruder.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(403);
    });

    it('returns 404 for nonexistent inventory ID', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const response = await request(app)
        .post('/api/weapon-inventory/999999999/refine')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });
      expect(response.status).toBe(403); // verifyWeaponOwnership returns 403 for missing rows
    });

    it('returns 403 WEAPON_REFINEMENT_TIER_LOCKED when Workshop level too low for tier', async () => {
      const ctx = await createRefineUser({ workshopLevel: 0, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('WEAPON_REFINEMENT_TIER_LOCKED');
      expect(response.body.details).toEqual(expect.objectContaining({ requiredWorkshopLevel: 1, currentWorkshopLevel: 0 }));
    });

    it('successfully refines at Workshop L1 (Hone)', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe(10_000); // 10K × 1²
      expect(response.body.weaponInventory.refinements).toHaveLength(1);
      expect(response.body.weaponInventory.refinements[0]).toEqual(expect.objectContaining({
        tier: 'hone', magnitude: 1, targetAttribute: 'combatPower', costPaid: 10_000, slotIndex: 1,
      }));

      // Currency decremented by exactly the cost
      expect(response.body.currency).toBe(990_000);

      // pricePaid incremented
      const updated = await prisma.weaponInventory.findUnique({ where: { id: inv.id } });
      expect(updated?.pricePaid).toBe(110_000);
    });

    it('successfully refines at Workshop L8 (Forge)', async () => {
      const ctx = await createRefineUser({ workshopLevel: 8, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { weaponType: { not: 'shield' } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id, 100_000);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'forge', magnitude: 1 });

      expect(response.status).toBe(200);
      expect(response.body.cost).toBe(400_000);
      expect(response.body.weaponInventory.refinements[0].tier).toBe('forge');
    });

    it('rejects Sharpen on a shield (SHIELD_CANNOT_TAKE_DPS_TIER)', async () => {
      const ctx = await createRefineUser({ workshopLevel: 5, currency: 1_000_000 });
      const shield = await prisma.weapon.findFirst({ where: { weaponType: 'shield' } });
      const inv = await giveRefineWeapon(ctx.user.id, shield!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'sharpen', magnitude: 1 });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WEAPON_REFINEMENT_SHIELD_CANNOT_TAKE_DPS_TIER');
    });

    it('rejects Hone on an attribute the weapon doesn\'t grant (ATTRIBUTE_NOT_ON_WEAPON)', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      // Find a weapon with a known zero attribute we can target
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: 0, name: { not: { contains: 'Practice' } } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WEAPON_REFINEMENT_ATTRIBUTE_NOT_ON_WEAPON');
    });

    it('rejects Augment on an attribute the weapon already grants (ATTRIBUTE_ALREADY_ON_WEAPON)', async () => {
      const ctx = await createRefineUser({ workshopLevel: 3, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'augment', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('WEAPON_REFINEMENT_ATTRIBUTE_ALREADY_ON_WEAPON');
    });

    it('returns 402 INSUFFICIENT_CREDITS when balance too low', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 5_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(402);
      expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('writes a weapon_refinement audit log entry on success', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const beforeCount = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_refinement' },
      });

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });
      expect(response.status).toBe(200);

      const afterCount = await prisma.auditLog.count({
        where: { userId: ctx.user.id, eventType: 'weapon_refinement' },
      });
      expect(afterCount).toBe(beforeCount + 1);
    });

    it('first refinement unlocks E22 "First Refinement"', async () => {
      const ctx = await createRefineUser({ workshopLevel: 1, currency: 1_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const response = await request(app)
        .post(`/api/weapon-inventory/${inv.id}/refine`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' });

      expect(response.status).toBe(200);
      const ids = (response.body.achievementUnlocks ?? []).map((a: { id: string }) => a.id);
      expect(ids).toContain('E22');
    });

    it('5th refinement on a weapon unlocks E24 "Legendary Smith"', async () => {
      const ctx = await createRefineUser({ workshopLevel: 8, currency: 10_000_000 });
      const weapon = await prisma.weapon.findFirst({ where: { combatPowerBonus: { gt: 0 }, weaponType: { not: 'shield' } } });
      const inv = await giveRefineWeapon(ctx.user.id, weapon!.id);

      const refineRequests = [
        { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' },
        { tier: 'hone', magnitude: 1, targetAttribute: 'combatPower' },
        { tier: 'sharpen', magnitude: 1 },
        { tier: 'sharpen', magnitude: 1 },
        { tier: 'forge', magnitude: 1 },
      ];

      let lastResponse;
      for (const body of refineRequests) {
        lastResponse = await request(app)
          .post(`/api/weapon-inventory/${inv.id}/refine`)
          .set('Authorization', `Bearer ${ctx.token}`)
          .send(body);
        expect(lastResponse.status).toBe(200);
      }

      const ids = (lastResponse!.body.achievementUnlocks ?? []).map((a: { id: string }) => a.id);
      expect(ids).toContain('E24');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // PATCH /api/weapon-inventory/:id/custom-name (Spec #34)
  // ─────────────────────────────────────────────────────────────────────

  describe('PATCH /api/weapon-inventory/:id/custom-name', () => {
    async function createNamingUser() {
      const user = await createTestUser();
      testUserIds.push(user.id);
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'test-secret',
      );
      return { user, token };
    }

    it('sets a custom name', async () => {
      const ctx = await createNamingUser();
      const weapon = await prisma.weapon.findFirst();
      const inv = await prisma.weaponInventory.create({
        data: { userId: ctx.user.id, weaponId: weapon!.id, pricePaid: 50_000 },
      });

      const response = await request(app)
        .patch(`/api/weapon-inventory/${inv.id}/custom-name`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ customName: 'Old Faithful' });

      expect(response.status).toBe(200);
      expect(response.body.weaponInventory.customName).toBe('Old Faithful');
    });

    it('clears a custom name when null is sent', async () => {
      const ctx = await createNamingUser();
      const weapon = await prisma.weapon.findFirst();
      const inv = await prisma.weaponInventory.create({
        data: { userId: ctx.user.id, weaponId: weapon!.id, pricePaid: 50_000, customName: 'Existing' },
      });

      const response = await request(app)
        .patch(`/api/weapon-inventory/${inv.id}/custom-name`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ customName: null });

      expect(response.status).toBe(200);
      expect(response.body.weaponInventory.customName).toBeNull();
    });

    it('rejects invalid characters', async () => {
      const ctx = await createNamingUser();
      const weapon = await prisma.weapon.findFirst();
      const inv = await prisma.weaponInventory.create({
        data: { userId: ctx.user.id, weaponId: weapon!.id, pricePaid: 50_000 },
      });

      const response = await request(app)
        .patch(`/api/weapon-inventory/${inv.id}/custom-name`)
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({ customName: '<script>alert(1)</script>' });

      expect(response.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const response = await request(app)
        .patch('/api/weapon-inventory/1/custom-name')
        .send({ customName: 'Hi' });
      expect(response.status).toBe(401);
    });

    it('returns 403 when targeting another user\'s weapon', async () => {
      const owner = await createNamingUser();
      const intruder = await createNamingUser();
      const weapon = await prisma.weapon.findFirst();
      const inv = await prisma.weaponInventory.create({
        data: { userId: owner.user.id, weaponId: weapon!.id, pricePaid: 50_000 },
      });

      const response = await request(app)
        .patch(`/api/weapon-inventory/${inv.id}/custom-name`)
        .set('Authorization', `Bearer ${intruder.token}`)
        .send({ customName: 'Stolen' });

      expect(response.status).toBe(403);
    });
  });
});
