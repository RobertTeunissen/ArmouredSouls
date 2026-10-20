/**
 * Issue #342 — achievements versus account reset and weapon/shield resale.
 *
 * A reset is a fresh start: unlock rows, prestige, titles and pins go, credits
 * return to the ₡3,000,000 opening balance, and every achievement can be earned
 * again exactly once. Buy/sell loops cannot farm: each achievement is unique
 * per user and resale is always below the price paid.
 *
 * The remaining hole was the history-based counters (E18–E20 weapon sales,
 * E22 refinements): they counted every `audit_logs` row for the user, and the
 * reset keeps audit history, so pre-reset sales carried over to the fresh
 * account. Those counters now start at the user's latest reset.
 *
 * This suite only creates and deletes its own rows (no truncation), so it lives
 * in the DB_DEPENDENT tier.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../src/lib/prisma';
import robotRoutes from '../../src/routes/robots';
import weaponInventoryRoutes from '../../src/routes/weaponInventory';
import onboardingRoutes from '../../src/routes/onboarding';
import { errorHandler } from '../../src/middleware/errorHandler';
import { eventLogger } from '../../src/services/common/eventLogger';
import { achievementService } from '../../src/services/achievement/achievementService';
import { checkWeaponsRefinedCount } from '../../src/services/achievement/triggerEvaluator';

const app = express();
app.use(express.json());
app.use('/api/robots', robotRoutes);
app.use('/api/weapon-inventory', weaponInventoryRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use(errorHandler);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const SUFFIX = randomUUID().slice(0, 8);
const OPENING_BALANCE = 3_000_000;

interface TestUser {
  id: number;
  token: string;
}

interface UnlockBody {
  achievementUnlocks: Array<{ id: string }>;
}

interface SaleBody extends UnlockBody {
  salePrice: number;
}

interface PurchaseBody extends UnlockBody {
  weaponInventory: { id: number; pricePaid: number };
}

const createdUserIds: number[] = [];
let userCounter = 0;

function idempotencyKey(): string {
  return `issue342-${randomUUID()}`;
}

async function createUser(label: string, facilities: Record<string, number>): Promise<TestUser> {
  userCounter += 1;
  const username = `r342_${label}_${userCounter}_${SUFFIX}`.slice(0, 32);
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@test.com`,
      passwordHash: 'test-hash',
      currency: OPENING_BALANCE,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
      onboardingStep: 1,
      onboardingChoices: {},
      onboardingStartedAt: new Date(),
    },
  });
  createdUserIds.push(user.id);
  await setFacilities(user.id, facilities);
  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id: user.id, token };
}

async function setFacilities(userId: number, facilities: Record<string, number>): Promise<void> {
  for (const [facilityType, level] of Object.entries(facilities)) {
    await prisma.facility.upsert({
      where: { userId_facilityType: { userId, facilityType } },
      create: { userId, facilityType, level },
      update: { level },
    });
  }
}

function ids(body: UnlockBody): string[] {
  return body.achievementUnlocks.map((a) => a.id).sort();
}

async function createRobot(user: TestUser, name: string): Promise<string[]> {
  const res = await request(app)
    .post('/api/robots')
    .set('Authorization', `Bearer ${user.token}`)
    .set('Idempotency-Key', idempotencyKey())
    .send({ name });
  expect(res.status).toBe(201);
  return ids(res.body as UnlockBody);
}

async function purchase(user: TestUser, weaponId: number): Promise<PurchaseBody> {
  const res = await request(app)
    .post('/api/weapon-inventory/purchase')
    .set('Authorization', `Bearer ${user.token}`)
    .set('Idempotency-Key', idempotencyKey())
    .send({ weaponId });
  expect(res.status).toBe(201);
  return res.body as PurchaseBody;
}

async function sell(user: TestUser, inventoryId: number): Promise<SaleBody> {
  const res = await request(app)
    .delete(`/api/weapon-inventory/${inventoryId}`)
    .set('Authorization', `Bearer ${user.token}`)
    .set('Idempotency-Key', idempotencyKey());
  expect(res.status).toBe(200);
  return res.body as SaleBody;
}

async function reset(user: TestUser): Promise<void> {
  const res = await request(app)
    .post('/api/onboarding/reset-account')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ confirmation: 'RESET' });
  expect(res.status).toBe(200);
}

async function completeOnboarding(user: TestUser): Promise<string[]> {
  const res = await request(app)
    .post('/api/onboarding/complete')
    .set('Authorization', `Bearer ${user.token}`)
    .send({});
  expect(res.status).toBe(200);
  return ids(res.body as UnlockBody);
}

async function unlockedIds(userId: number): Promise<string[]> {
  const rows = await prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } });
  return rows.map((r) => r.achievementId).sort();
}

async function progressOf(userId: number, achievementId: string): Promise<number | undefined> {
  const catalog = await achievementService.getPlayerAchievements(userId);
  return catalog.achievements.find((a) => a.id === achievementId)?.progress?.current;
}

async function cheapestShieldId(): Promise<number> {
  const shield = await prisma.weapon.findFirst({
    where: { weaponType: 'shield' },
    orderBy: { cost: 'asc' },
    select: { id: true },
  });
  if (!shield) throw new Error('No shield seeded');
  return shield.id;
}

// Nested under one describe so this cleanup runs before the setup file's
// root-level `prisma.$disconnect()` (a later query would reopen the pool).
describe('Issue #342 — achievements, reset and resale', () => {
  afterAll(async () => {
    const robots = await prisma.robot.findMany({ where: { userId: { in: createdUserIds } }, select: { id: true } });
    const robotIds = robots.map((r) => r.id);
    const steps: Array<() => Promise<unknown>> = [
      () => prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } }),
      () => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }),
      () => prisma.financialLedger.deleteMany({ where: { userId: { in: createdUserIds } } }),
      () => prisma.resetLog.deleteMany({ where: { userId: { in: createdUserIds } } }),
      () => prisma.robot.updateMany({
        where: { userId: { in: createdUserIds } },
        data: { mainWeaponId: null, offhandWeaponId: null },
      }),
      () => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }),
    ];
    for (const step of steps) {
      try {
        await step();
      } catch {
        // Keep cleaning up the remaining rows even if one step fails.
      }
    }
  });

  describe('Issue #342 — achievements and account reset', () => {
    it('onboarding robot achievement is revoked by reset and re-earned exactly once', async () => {
      const user = await createUser('a', { roster_expansion: 2 });

      const before = [
        await createRobot(user, `R342 A1 ${SUFFIX}`),
        await createRobot(user, `R342 A2 ${SUFFIX}`),
        await createRobot(user, `R342 A3 ${SUFFIX}`),
      ];
      expect(before).toEqual([[], [], ['E12']]);
      const earned = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(earned.prestige).toBeGreaterThan(0);
      expect(await prisma.financialLedger.count({
        where: { userId: user.id, transactionType: 'achievement_reward' },
      })).toBe(1);
      const prestigeAuditBefore = await prisma.auditLog.count({ where: { userId: user.id, eventType: 'prestige_change' } });
      expect(prestigeAuditBefore).toBeGreaterThan(0);

      await reset(user);

      expect(await unlockedIds(user.id)).toEqual([]);
      const afterReset = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterReset.prestige).toBe(0);
      expect(afterReset.currency).toBe(OPENING_BALANCE);
      // History stays: the pre-reset reward pair and prestige audit row survive.
      expect(await prisma.financialLedger.count({
        where: { userId: user.id, transactionType: 'achievement_reward' },
      })).toBe(1);
      expect(await prisma.auditLog.count({ where: { userId: user.id, eventType: 'prestige_change' } }))
        .toBe(prestigeAuditBefore);

      await setFacilities(user.id, { roster_expansion: 3 });
      const after = [
        await createRobot(user, `R342 A4 ${SUFFIX}`),
        await createRobot(user, `R342 A5 ${SUFFIX}`),
        await createRobot(user, `R342 A6 ${SUFFIX}`),
        await createRobot(user, `R342 A7 ${SUFFIX}`),
      ];
      expect(after).toEqual([[], [], ['E12'], []]);
      const rewards = await prisma.financialLedger.findMany({
        where: { userId: user.id, transactionType: 'achievement_reward' },
        select: { financialEventId: true },
      });
      expect(rewards).toHaveLength(2);
      expect(new Set(rewards.map((r) => r.financialEventId)).size).toBe(2);
    });

    it('reset stays available after onboarding and the onboarding achievement is re-earned once', async () => {
      const user = await createUser('b', {});

      expect(await completeOnboarding(user)).toEqual(['E1']);
      await reset(user);
      const afterReset = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterReset.hasCompletedOnboarding).toBe(false);
      expect(afterReset.prestige).toBe(0);
      expect(await unlockedIds(user.id)).toEqual([]);

      expect(await completeOnboarding(user)).toEqual(['E1']);
      expect(await completeOnboarding(user)).toEqual([]);
    });
  });

  describe('Issue #342 — weapon and shield buy/sell loops', () => {
    it('a shield buy/sell loop cannot farm achievements or credits', async () => {
      const user = await createUser('c', { weapons_workshop: 1 });
      const shieldId = await cheapestShieldId();

      const purchaseUnlocks: string[][] = [];
      const saleUnlocks: string[][] = [];
      for (let loop = 0; loop < 3; loop++) {
        const bought = await purchase(user, shieldId);
        purchaseUnlocks.push(ids(bought));
        const sold = await sell(user, bought.weaponInventory.id);
        saleUnlocks.push(ids(sold));
        expect(sold.salePrice).toBeLessThan(bought.weaponInventory.pricePaid);
      }

      expect(purchaseUnlocks).toEqual([['E5', 'E7'], [], []]);
      expect(saleUnlocks).toEqual([['E18'], [], []]);
      expect(await prisma.financialLedger.count({
        where: { userId: user.id, transactionType: 'achievement_reward' },
      })).toBe(3);
      // Milestone purchase achievements stay earned after the item is sold.
      expect(await prisma.weaponInventory.count({ where: { userId: user.id } })).toBe(0);
      expect(await unlockedIds(user.id)).toEqual(['E18', 'E5', 'E7']);
    });
  });

  describe('Issue #342 — history-based counters restart after a reset', () => {
    it('pre-reset weapon sales do not count towards post-reset sale achievements', async () => {
      const user = await createUser('d', { weapons_workshop: 1 });
      const shieldId = await cheapestShieldId();

      const bought = await purchase(user, shieldId);
      await sell(user, bought.weaponInventory.id);
      for (let i = 0; i < 8; i++) {
        await eventLogger.logWeaponSale(1, user.id, shieldId, 100_000);
      }
      expect(await progressOf(user.id, 'E20')).toBe(9);

      await reset(user);

      expect(await progressOf(user.id, 'E20')).toBe(0);
      expect(await progressOf(user.id, 'E19')).toBe(0);

      await setFacilities(user.id, { weapons_workshop: 1 });
      const again = await purchase(user, shieldId);
      const sold = await sell(user, again.weaponInventory.id);
      expect(ids(sold)).toEqual(['E18']);
      expect(await progressOf(user.id, 'E20')).toBe(1);
      expect(await progressOf(user.id, 'E19')).toBe(sold.salePrice);
    });

    it('pre-reset refinements do not count towards the post-reset refinement achievement', async () => {
      const user = await createUser('e', {});
      const shieldId = await cheapestShieldId();

      await eventLogger.logWeaponRefinement(1, user.id, {
        weaponInventoryId: 0,
        weaponId: shieldId,
        tier: 'hone',
        magnitude: 1,
        targetAttribute: null,
        costPaid: 10_000,
        refinementLabLevel: 1,
      });
      expect(await checkWeaponsRefinedCount(user.id, 1)).toBe(true);

      await reset(user);

      expect(await checkWeaponsRefinedCount(user.id, 1)).toBe(false);
    });
  });
});
