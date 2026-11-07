/**
 * GET /api/robots/:id/profile (#504) — real database.
 */
import request from 'supertest';
import express from 'express';
import type { Server } from 'http';
import prisma from '../src/lib/prisma';
import robotRoutes from '../src/routes/robots';
import { errorHandler } from '../src/middleware/errorHandler';
import { generateToken } from '../src/services/auth/jwtService';
import { enterRobotStanding } from './helpers/standings';

const app = express();
app.use(express.json());
app.use('/api/robots', robotRoutes);
app.use(errorHandler);

describe('GET /api/robots/:id/profile', () => {
  let server: Server;
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let ownerId: number;
  let viewerToken: string;
  let robotId: number;
  let rivalId: number;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const owner = await prisma.user.create({ data: { username: `rp_o_${suffix}`, passwordHash: 'x', role: 'user' } });
    const viewer = await prisma.user.create({ data: { username: `rp_v_${suffix}`, passwordHash: 'x', role: 'user' } });
    ownerId = owner.id;
    viewerToken = generateToken({ id: String(viewer.id), username: viewer.username, role: 'user', tokenVersion: 0 });
    const robot = await prisma.robot.create({ data: { name: `RP Bot ${suffix}`, userId: owner.id, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10 } });
    const rival = await prisma.robot.create({ data: { name: `RP Rival ${suffix}`, userId: viewer.id, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10 } });
    robotId = robot.id;
    rivalId = rival.id;
    const instance = `gold_${9000 + Math.floor(Math.random() * 999)}`;
    await enterRobotStanding(robotId, 'league_1v1', { tier: 'gold', leagueInstanceId: instance, leaguePoints: 40, wins: 5, losses: 2 });
    await enterRobotStanding(rivalId, 'league_1v1', { tier: 'gold', leagueInstanceId: instance, leaguePoints: 60, wins: 7, losses: 1 });
  });

  afterAll(async () => {
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: [robotId, rivalId] } } });
    await prisma.robot.deleteMany({ where: { id: { in: [robotId, rivalId] } } });
    await prisma.user.deleteMany({ where: { username: { in: [`rp_o_${suffix}`, `rp_v_${suffix}`] } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const auth = (): [string, string] => ['Authorization', `Bearer ${viewerToken}`];

  it('requires authentication', async () => {
    expect((await request(server).get(`/api/robots/${robotId}/profile`)).status).toBe(401);
  });

  it('returns 404 for an unknown robot', async () => {
    expect((await request(server).get('/api/robots/999999999/profile').set(...auth())).status).toBe(404);
  });

  it('returns standings ranked within the league instance, and no build data', async () => {
    const res = await request(server).get(`/api/robots/${robotId}/profile`).set(...auth());

    expect(res.status).toBe(200);
    expect(res.body.standings).toHaveLength(1);
    expect(res.body.standings[0]).toMatchObject({ mode: 'league_1v1', tier: 'gold', leaguePoints: 40, rank: 2, instanceSize: 2, wins: 5, losses: 2 });
    expect(res.body.form).toEqual([]);
    expect(res.body.achievements).toEqual([]);
    expect(res.body.accolades).toEqual([]);
    expect(JSON.stringify(res.body)).not.toMatch(/"(combatPower|stance|yieldThreshold|mainWeapon|loadoutType)"/);
    expect(ownerId).toBeGreaterThan(0);
  });
});
