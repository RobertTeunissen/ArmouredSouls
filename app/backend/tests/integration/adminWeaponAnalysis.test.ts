/**
 * Admin Weapons analysis against the real database: weapon ids, refinement
 * tiers and league tiers read with the battle-time builds (KotH tiers come from
 * the scheduled match), the catalogue and player ownership queries, and the
 * route's validation and admin-only access.
 *
 * Build records are dated in 2099 and read with `from` = 2099, so records
 * written by other suites never leak in.
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
import { loadComparisons } from '../../src/services/admin/analysis/analysisData';
import { REFINEMENT_TIER_BITS } from '../../src/services/admin/analysis/attributeLayers';
import { loadWeaponCatalogue, weaponsOwnedByPlayers } from '../../src/services/admin/analysis/weaponCatalogue';

const TAG = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const FROM = new Date('2099-01-01T00:00:00Z');
const AT = new Date('2099-01-02T00:00:00Z');

let server: http.Server;
let adminToken: string;
let playerToken: string;
const userIds: number[] = [];
const battleIds: number[] = [];
const weaponIds: number[] = [];
const robot: Record<string, number> = {};

const attrs = (value: number): Record<string, number> => Object.fromEntries(ROBOT_ATTRIBUTES.map((a) => [a, value]));

async function makeUser(label: string, stableType: 'human' | 'generated', role = 'user'): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `wa_${label}_${TAG}`, passwordHash: 'unused', role, stableType, stableName: `${label} ${TAG}`.slice(0, 30) },
  });
  userIds.push(user.id);
  return user.id;
}

async function makeWeapon(name: string, rangeBand: string, handsRequired: string): Promise<number> {
  const weapon = await prisma.weapon.create({
    data: {
      name: `${name} ${TAG}`, weaponType: 'melee', baseDamage: 10, cooldown: 3, cost: 1000, handsRequired,
      damageType: 'melee', loadoutType: 'any', rangeBand,
    },
  });
  weaponIds.push(weapon.id);
  return weapon.id;
}

interface P { robot: string; team: number; placement?: number; main: number; offhand?: number | null; loadout: string; refinements?: string[] }

async function makeBattle(battleType: string, leagueType: string, p: P[], winnerId: number | null): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType,
      leagueType,
      winnerId,
      durationSeconds: 60,
      participants: {
        create: p.map((x) => ({
          robotId: robot[x.robot], team: x.team, credits: 0, eloBefore: 1500, eloAfter: 1500, finalHP: 10, placement: x.placement ?? null,
        })),
      },
    },
  });
  battleIds.push(battle.id);
  await prisma.battleParticipantBuild.createMany({
    data: p.map((x) => ({
      battleId: battle.id,
      robotId: robot[x.robot],
      battleType,
      baseAttributes: attrs(10),
      tuning: {},
      effectiveAttributes: attrs(10),
      mainWeaponId: x.main,
      mainRefinements: (x.refinements ?? []).map((tier) => ({ tier, magnitude: 1, targetAttribute: null })),
      offhandWeaponId: x.offhand ?? null,
      loadoutType: x.loadout,
      stance: 'balanced',
      yieldThreshold: 10,
      createdAt: AT,
    })),
  });
  return battle.id;
}

let mace: number;
let buckler: number;
let rifle: number;
let kothBattle: number;

beforeAll(async () => {
  const human = await makeUser('Human', 'human');
  const gen = await makeUser('Gen', 'generated');
  const admin = await makeUser('Admin', 'human', 'admin');
  adminToken = generateToken({ id: String(admin), username: `wa_Admin_${TAG}`, role: 'admin', tokenVersion: 0 });
  playerToken = generateToken({ id: String(human), username: `wa_Human_${TAG}`, role: 'user', tokenVersion: 0 });
  mace = await makeWeapon('Mace', 'melee', 'one');
  buckler = await makeWeapon('Buckler', 'melee', 'shield');
  rifle = await makeWeapon('Rifle', 'long', 'two');
  await prisma.weaponInventory.create({ data: { userId: human, weaponId: mace, pricePaid: 1000 } });
  await prisma.weaponInventory.create({ data: { userId: gen, weaponId: rifle, pricePaid: 0 } });
  for (const [key, owner] of [['H1', human], ['G1', gen], ['G2', gen]] as const) {
    robot[key] = (await createTestRobot(owner, `Wa${key}${TAG}`)).id;
  }
  await makeBattle('league_1v1', 'diamond', [
    { robot: 'H1', team: 1, main: mace, offhand: buckler, loadout: 'weapon_shield', refinements: ['hone', 'sharpen'] },
    { robot: 'G1', team: 2, main: rifle, loadout: 'two_handed' },
  ], robot.H1);
  kothBattle = await makeBattle('koth', 'koth', [
    { robot: 'G1', team: 1, placement: 1, main: rifle, loadout: 'two_handed' },
    { robot: 'G2', team: 1, placement: 2, main: mace, loadout: 'single' },
  ], robot.G1);
  // KotH battle rows say 'koth'; the tier is on the scheduled match.
  await prisma.scheduledMatch.create({ data: { matchType: 'koth', scheduledFor: AT, status: 'completed', battleId: kothBattle, leagueType: 'platinum' } });

  const app = express();
  app.use(express.json());
  app.use('/api/admin/analysis', adminAnalysisRoutes);
  app.use(errorHandler);
  server = await new Promise<http.Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
});

afterAll(async () => {
  await prisma.scheduledMatch.deleteMany({ where: { battleId: kothBattle } });
  await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: Object.values(robot) } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.weapon.deleteMany({ where: { id: { in: weaponIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('weapon analysis data', () => {
  it('reads weapon ids, refinement tiers and league tiers with the builds', async () => {
    const { set } = await loadComparisons(FROM, 1);
    const duel = set.appearances.filter((a) => a.column === 'duel');
    const human = duel.find((a) => a.human);
    expect(human?.tier).toBe('diamond');
    expect(human?.build.mainWeaponId).toBe(mace);
    expect(human?.build.offhandWeaponId).toBe(buckler);
    expect(human?.build.loadoutType).toBe('weapon_shield');
    expect(human?.build.refinementTiers).toBe(REFINEMENT_TIER_BITS.hone | REFINEMENT_TIER_BITS.sharpen);
    expect(human?.build.invested).toBe(10 * ROBOT_ATTRIBUTES.length);
    const koth = set.appearances.filter((a) => a.column === 'multi');
    expect(koth.map((a) => a.tier)).toEqual(['platinum', 'platinum']);
  });

  it('loads the catalogue and which weapons players own', async () => {
    const catalogue = await loadWeaponCatalogue();
    expect(catalogue.find((w) => w.id === rifle)).toMatchObject({ rangeBand: 'long', handsRequired: 'two', cost: 1000 });
    const owned = await weaponsOwnedByPlayers();
    expect(owned.has(mace)).toBe(true);
    expect(owned.has(rifle)).toBe(false);
  });
});

describe('GET /api/admin/analysis/weapons', () => {
  it('answers admins with an analysis or the collecting state', async () => {
    const res = await request(server).get('/api/admin/analysis/weapons?range=7d&strength=top10').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(['ready', 'collecting']).toContain(res.body.status);
  });

  it('validates the query', async () => {
    const badRange = await request(server).get('/api/admin/analysis/weapons?range=1y').set('Authorization', `Bearer ${adminToken}`);
    expect(badRange.status).toBe(400);
    const badStrength = await request(server).get('/api/admin/analysis/weapons?strength=top5').set('Authorization', `Bearer ${adminToken}`);
    expect(badStrength.status).toBe(400);
  });

  it('is admin-only', async () => {
    expect((await request(server).get('/api/admin/analysis/weapons')).status).toBe(401);
    expect((await request(server).get('/api/admin/analysis/weapons').set('Authorization', `Bearer ${playerToken}`)).status).toBe(403);
  });
});
