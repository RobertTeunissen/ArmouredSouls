/**
 * Admin Attributes analysis against the real database: reading battle-time
 * builds into comparisons (outcomes per mode, skips, human share, sampling)
 * and the route's validation and admin-only access.
 *
 * The test's build records are dated in 2099 and read with `from` = 2099, so
 * records written by other suites never leak in.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import adminAnalysisRoutes from '../../src/routes/adminAnalysis';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import { createTestRobot } from '../testHelpers';
import { ROBOT_ATTRIBUTES } from '../../src/shared/utils/robotAttributes';
import { countRecordedBattles, getRecordingBounds, loadComparisons } from '../../src/services/admin/analysis/analysisData';
import { layerValue, layeredValues } from '../../src/services/admin/analysis/attributeLayers';
import { ALL_LAYERS_ON } from '../../src/services/admin/analysis/analysisOptions';

const TAG = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const FROM = new Date('2099-01-01T00:00:00Z');
const AT = new Date('2099-01-02T00:00:00Z');

let server: http.Server;
let adminToken: string;
let playerToken: string;
const userIds: number[] = [];
const battleIds: number[] = [];
const robot: Record<string, number> = {};

const attrs = (value: number): Record<string, number> => Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => [a, value]));

async function makeUser(label: string, stableType: 'human' | 'generated', role = 'user'): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `aa_${label}_${TAG}`, passwordHash: 'unused', role, stableType, stableName: `${label} ${TAG}`.slice(0, 30) },
  });
  userIds.push(user.id);
  return user.id;
}

interface P { robot: string; team: number; placement?: number; build?: number | null; forfeited?: boolean }

async function makeBattle(battleType: string, p: P[], result: { winnerId?: number | null; winningSide?: number | null } = {}): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType,
      leagueType: 'gold',
      leagueInstanceId: 'gold_1',
      winnerId: result.winnerId ?? null,
      winningSide: result.winningSide ?? null,
      durationSeconds: 60,
      participants: {
        create: p.map((x) => ({
          robotId: robot[x.robot], team: x.team, credits: 0, eloBefore: 1500, eloAfter: 1500, finalHP: 10,
          placement: x.placement ?? null, forfeited: x.forfeited ?? false,
        })),
      },
    },
  });
  battleIds.push(battle.id);
  const builds = p.filter((x) => x.build !== null && !x.forfeited);
  await prisma.battleParticipantBuild.createMany({
    data: builds.map((x) => ({
      battleId: battle.id,
      robotId: robot[x.robot],
      battleType,
      baseAttributes: attrs(x.build ?? 10),
      tuning: { combatPower: 2 },
      effectiveAttributes: { ...attrs((x.build ?? 10) * 1.1), combatPower: ((x.build ?? 10) + 2) * 1.1 },
      mainWeaponId: null,
      mainRefinements: [{ tier: 'hone', magnitude: 1, targetAttribute: 'penetration' }],
      loadoutType: 'single',
      stance: 'offensive',
      yieldThreshold: 10,
      createdAt: AT,
    })),
  });
  return battle.id;
}

beforeAll(async () => {
  const human = await makeUser('Human', 'human');
  const gen = await makeUser('Gen', 'generated');
  const admin = await makeUser('Admin', 'human', 'admin');
  adminToken = generateToken({ id: String(admin), username: `aa_Admin_${TAG}`, role: 'admin', tokenVersion: 0 });
  playerToken = generateToken({ id: String(human), username: `aa_Human_${TAG}`, role: 'user', tokenVersion: 0 });
  for (const [key, owner] of [['H1', human], ['H2', human], ['G1', gen], ['G2', gen], ['G3', gen], ['G4', gen]] as const) {
    robot[key] = (await createTestRobot(owner, `Aa${key}${TAG}`)).id;
  }
  // 1v1 won by robot H1 (winner_id is a robot id).
  await makeBattle('league_1v1', [{ robot: 'H1', team: 1, build: 20 }, { robot: 'G1', team: 2, build: 10 }], { winnerId: robot.H1 });
  // 2v2 won by side 2 (winner_id would be a team id; winning_side decides).
  await makeBattle('league_2v2', [
    { robot: 'H1', team: 1 }, { robot: 'H2', team: 1 }, { robot: 'G1', team: 2 }, { robot: 'G2', team: 2 },
  ], { winnerId: 123456, winningSide: 2 });
  // Draw.
  await makeBattle('league_1v1', [{ robot: 'G1', team: 1 }, { robot: 'G2', team: 2 }]);
  // Forfeit: the forfeiter has no build.
  await makeBattle('league_1v1', [{ robot: 'G3', team: 1 }, { robot: 'G4', team: 2, forfeited: true }], { winnerId: robot.G3 });
  // KotH with three placements: three pairs.
  await makeBattle('koth', [
    { robot: 'G1', team: 1, placement: 1 }, { robot: 'G2', team: 1, placement: 2 }, { robot: 'H2', team: 1, placement: 3 },
  ], { winnerId: robot.G1 });

  const app = express();
  app.use(express.json());
  app.use('/api/admin/analysis', adminAnalysisRoutes);
  app.use(errorHandler);
  server = await new Promise<http.Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
});

afterAll(async () => {
  await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: Object.values(robot) } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('analysis data', () => {
  it('counts recorded battles per type in the window', async () => {
    const counts = await countRecordedBattles(FROM);
    expect(Object.fromEntries(counts)).toEqual({ league_1v1: 3, league_2v2: 1, koth: 1 });
  });

  it('reads battles into comparisons with outcomes, skips and the human share', async () => {
    const { set, battlesRead } = await loadComparisons(FROM, 1);
    expect(battlesRead).toBe(5);
    expect(set.battles).toEqual({ duel: 1, team: 1, multi: 1 });
    expect(set.skipped).toEqual({ draws: 1, forfeits: 1, missingBuilds: 0, tiedPlacements: 0 });

    const duel = set.comparisons.find((c) => c.column === 'duel');
    expect(duel).toMatchObject({ y: 1, w: 1 });
    const team = set.comparisons.find((c) => c.column === 'team');
    expect(team).toMatchObject({ y: 0, w: 1 });
    expect(team?.a).toHaveLength(2);
    const koth = set.comparisons.filter((c) => c.column === 'multi');
    expect(koth).toHaveLength(3);
    expect(koth.reduce((s, c) => s + c.w, 0)).toBeCloseTo(1.5, 10);

    // 2 (duel) + 4 (2v2) + 3 (KotH) robots that fought; H1 twice and H2 twice are human.
    expect(set.appearances).toHaveLength(9);
    expect(set.appearances.filter((a) => a.human)).toHaveLength(4);
  });

  it('rebuilds layers from the stored JSON', async () => {
    const { set } = await loadComparisons(FROM, 1);
    const duel = set.comparisons.find((c) => c.column === 'duel');
    const winner = duel?.a[0];
    expect(winner).toBeDefined();
    const cp = ROBOT_ATTRIBUTES.indexOf('combatPower');
    const pen = ROBOT_ATTRIBUTES.indexOf('penetration');
    expect(layerValue(winner!, 'base', cp)).toBe(20);
    expect(layerValue(winner!, 'tuning', cp)).toBe(2);
    expect(layerValue(winner!, 'refinements', pen)).toBe(1);
    // Stance is kept as its own effect; it never changes the attribute values (combat doesn't either).
    expect(winner?.stance).toBe('offensive');
    const values = layeredValues(winner!, ALL_LAYERS_ON);
    expect(values[cp]).toBeCloseTo((20 + 2) * 1.1, 1);
    expect(layeredValues(winner!, { ...ALL_LAYERS_ON, stance: false })[cp]).toBe(values[cp]);
  });

  it('samples deterministically by battle id', async () => {
    const none = await loadComparisons(FROM, 0);
    expect(none.battlesRead).toBe(0);
    const first = await loadComparisons(FROM, 0.5);
    const second = await loadComparisons(FROM, 0.5);
    expect(second.battlesRead).toBe(first.battlesRead);
    expect(second.set.comparisons.map((c) => c.battleId)).toEqual(first.set.comparisons.map((c) => c.battleId));
  });

  it('reports where recording started and the newest record', async () => {
    const bounds = await getRecordingBounds();
    expect(bounds.since).not.toBeNull();
    const newest = await prisma.battleParticipantBuild.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    expect(bounds.newestId).toBe(newest?.id);
  });
});

describe('GET /api/admin/analysis/attributes', () => {
  it('answers admins with an analysis or the collecting state', async () => {
    const res = await request(server).get('/api/admin/analysis/attributes?range=7d&stance=false').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(['ready', 'collecting']).toContain(res.body.status);
    if (res.body.status === 'ready') expect(res.body.toggles).toEqual({ tuning: true, weapons: true, refinements: true, loadout: true, stance: false });
  });

  it('validates the query', async () => {
    const badRange = await request(server).get('/api/admin/analysis/attributes?range=1y').set('Authorization', `Bearer ${adminToken}`);
    expect(badRange.status).toBe(400);
    const badFlag = await request(server).get('/api/admin/analysis/attributes?tuning=maybe').set('Authorization', `Bearer ${adminToken}`);
    expect(badFlag.status).toBe(400);
  });

  it('is admin-only', async () => {
    expect((await request(server).get('/api/admin/analysis/attributes')).status).toBe(401);
    expect((await request(server).get('/api/admin/analysis/attributes').set('Authorization', `Bearer ${playerToken}`)).status).toBe(403);
  });
});
