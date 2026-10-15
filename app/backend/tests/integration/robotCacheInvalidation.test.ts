/**
 * T21 — every loadout mutation refreshes the `GET /api/robots` cache
 * (design §9.1, rule 9).
 *
 * `findUserRobots` caches the robot list per user for 30 s. Robot creation and
 * main-weapon equip invalidated it, but unequip-main, unequip-offhand,
 * equip-offhand and the loadout change did not. The dashboard reads that list,
 * so after unequipping a weapon it kept showing the old loadout (and no
 * readiness alert) until the TTL ran out. Real database, one listening server
 * for the whole file.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import robotRoutes from '../../src/routes/robots';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';

const RUN = `rci${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const app = express();
app.use(express.json());
app.use('/api/robots', robotRoutes);
app.use(errorHandler);

interface RobotListRow {
  id: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  loadoutType: string;
}

interface Fixture {
  token: string;
  robotId: number;
  mainInvId: number;
  shieldInvId: number;
}

describe('GET /api/robots cache after loadout changes (T21)', () => {
  let server: http.Server;
  let oneHandedWeaponId: number;
  let shieldWeaponId: number;
  const userIds: number[] = [];
  let counter = 0;

  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const oneHanded = await prisma.weapon.findFirst({ where: { handsRequired: 'one' }, orderBy: { id: 'asc' } });
    const shield = await prisma.weapon.findFirst({ where: { handsRequired: 'shield' }, orderBy: { id: 'asc' } });
    if (!oneHanded || !shield) throw new Error('Seeded weapons missing: need a one-handed weapon and a shield');
    oneHandedWeaponId = oneHanded.id;
    shieldWeaponId = shield.id;
  });

  afterAll(async () => {
    await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** A fresh user per test, so a warmed cache entry never leaks between tests. */
  async function createFixture(opts: { loadoutType: string; withMain: boolean; withShield: boolean }): Promise<Fixture> {
    counter += 1;
    const username = `${RUN}_u${counter}`;
    const user = await prisma.user.create({ data: { username, passwordHash: 'x' } });
    userIds.push(user.id);
    const mainInv = await prisma.weaponInventory.create({ data: { userId: user.id, weaponId: oneHandedWeaponId, pricePaid: 0 } });
    const shieldInv = await prisma.weaponInventory.create({ data: { userId: user.id, weaponId: shieldWeaponId, pricePaid: 0 } });
    const robot = await prisma.robot.create({
      data: {
        userId: user.id,
        name: `${RUN}_r${counter}`,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        loadoutType: opts.loadoutType,
        mainWeaponId: opts.withMain ? mainInv.id : null,
        offhandWeaponId: opts.withShield ? shieldInv.id : null,
      },
    });
    return {
      token: generateToken({ id: String(user.id), username, role: 'user', tokenVersion: 0 }),
      robotId: robot.id,
      mainInvId: mainInv.id,
      shieldInvId: shieldInv.id,
    };
  }

  async function listRobot(fx: Fixture): Promise<RobotListRow> {
    const res = await request(server).get('/api/robots').set('Authorization', `Bearer ${fx.token}`);
    expect(res.status).toBe(200);
    const row = (res.body as RobotListRow[]).find((r) => r.id === fx.robotId);
    if (!row) throw new Error(`Robot ${fx.robotId} missing from GET /api/robots`);
    return row;
  }

  it('unequip main weapon: the next GET shows mainWeaponId null', async () => {
    const fx = await createFixture({ loadoutType: 'single', withMain: true, withShield: false });
    expect((await listRobot(fx)).mainWeaponId).toBe(fx.mainInvId); // warms the cache
    const res = await request(server)
      .delete(`/api/robots/${fx.robotId}/unequip-main-weapon`)
      .set('Authorization', `Bearer ${fx.token}`);
    expect(res.status).toBe(200);
    expect((await listRobot(fx)).mainWeaponId).toBeNull();
  });

  it('unequip offhand weapon: the next GET shows offhandWeaponId null', async () => {
    const fx = await createFixture({ loadoutType: 'weapon_shield', withMain: true, withShield: true });
    expect((await listRobot(fx)).offhandWeaponId).toBe(fx.shieldInvId);
    const res = await request(server)
      .delete(`/api/robots/${fx.robotId}/unequip-offhand-weapon`)
      .set('Authorization', `Bearer ${fx.token}`);
    expect(res.status).toBe(200);
    expect((await listRobot(fx)).offhandWeaponId).toBeNull();
  });

  it('equip offhand weapon: the next GET shows the new offhandWeaponId', async () => {
    const fx = await createFixture({ loadoutType: 'weapon_shield', withMain: true, withShield: false });
    expect((await listRobot(fx)).offhandWeaponId).toBeNull();
    const res = await request(server)
      .put(`/api/robots/${fx.robotId}/equip-offhand-weapon`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ weaponInventoryId: fx.shieldInvId });
    expect(res.status).toBe(200);
    expect((await listRobot(fx)).offhandWeaponId).toBe(fx.shieldInvId);
  });

  it('change loadout type: the next GET shows the new loadoutType', async () => {
    const fx = await createFixture({ loadoutType: 'single', withMain: true, withShield: false });
    expect((await listRobot(fx)).loadoutType).toBe('single');
    const res = await request(server)
      .put(`/api/robots/${fx.robotId}/loadout-type`)
      .set('Authorization', `Bearer ${fx.token}`)
      .send({ loadoutType: 'weapon_shield' });
    expect(res.status).toBe(200);
    expect((await listRobot(fx)).loadoutType).toBe('weapon_shield');
  });
});
