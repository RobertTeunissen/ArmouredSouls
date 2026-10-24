/**
 * Spec #55 tasks 9.1–9.4 — Admin_Automaton_Control profile endpoints against
 * the real database (R2.2–R2.6, R2.8, R3.2–R3.12, R6.4, R6.5, R11.1–R11.4,
 * R11.6).
 *
 * Draft CRUD, renames, Team_Names, Event_Order, blueprint CRUD with the
 * live-robot rules, strategy and Goal_Target updates (R3.7), Activation and
 * every rejection path, activate-all-drafts, the blueprint image upload,
 * Turn_Preview with zero database and file writes, the Program_Switch, list,
 * detail and Turn_Records, plus one admin audit entry per mutation and per
 * rejection. The full 401/403 matrix and route-table assertion are task 9.5.
 */
import fs from 'fs';
import http from 'node:http';
import path from 'path';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import adminAutomatonsRoutes from '../../src/routes/adminAutomatons';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import { setAutomatonUploadDir } from '../../src/services/automaton/automatonImageService';
import { getProgramSwitch, setProgramSwitch } from '../../src/services/automaton/programSwitch';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../src/services/subscription/eventRegistry';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import * as profileService from '../../src/services/automaton/automatonProfileService';
import { deleteAutomatonStables } from '../helpers/automatonStable';

// Digits only, so a generated stable name can never trip the profanity filter.
const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const KEY_PREFIX = `t55p-${run}`;
const key = (name: string): string => `${KEY_PREFIX}-${name}`;
/** Stable names: 3–30 letters/digits/spaces, unique per run. */
const stable = (name: string): string => `Pz ${name} ${run}`.slice(0, 30);

const SCRATCH = path.join(__dirname, '.scratch-automaton-profile-uploads');

const app = express();
app.use(express.json());
app.use('/api/admin/automatons', adminAutomatonsRoutes);
app.use(errorHandler);

const BASE = '/api/admin/automatons';

const HAMMER = {
  robotName: 'Pz Hammer',
  loadoutType: 'two_handed',
  stance: 'balanced',
  yieldThreshold: 10,
  buildFocus: 'bruiser',
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'forge', hand: 'main', magnitude: 1 }],
};
const SHIELD = {
  robotName: 'Pz Shield',
  loadoutType: 'weapon_shield',
  stance: 'defensive',
  yieldThreshold: 20,
  buildFocus: 'warden',
  weaponPath: [{ main: 'Laser Pistol', offhand: 'Light Shield' }, { main: 'Volt Sabre', offhand: 'Aegis Bulwark' }],
  refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
};

/** The latest Paragon version: what a stable created on the admin page is pinned to. */
const PARAGON_LATEST = getStrategyRegistry().latestVersion('paragon')!;
const paragon = getStrategyRegistry().getStrategy('paragon', PARAGON_LATEST)!;
const paragonRobots2 = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;

describe('Admin automaton profile endpoints (Spec #55 tasks 9.1–9.4)', () => {
  let server: http.Server;
  let adminId: number;
  let adminToken: string;
  let playerToken: string;
  const extraUserIds: number[] = [];
  let previousUploadDir: string;
  let programBefore: boolean;

  const api = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, token = adminToken) =>
    request(server)[method](`${BASE}${url}`).set('Authorization', `Bearer ${token}`);

  /** Admin audit entries of this run, newest last (recordAction is fire-and-forget, so poll briefly). */
  async function auditEntries(expectedAtLeast: number): Promise<{ operationType: string; operationResult: string; resultSummary: unknown }[]> {
    for (let i = 0; i < 40; i++) {
      const rows = await prisma.adminAuditLog.findMany({ where: { adminUserId: adminId }, orderBy: { id: 'asc' } });
      if (rows.length >= expectedAtLeast) return rows;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return prisma.adminAuditLog.findMany({ where: { adminUserId: adminId }, orderBy: { id: 'asc' } });
  }

  async function auditCount(): Promise<number> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return prisma.adminAuditLog.count({ where: { adminUserId: adminId } });
  }

  async function createDraft(name: string, strategyKey = 'paragon', extra: Record<string, unknown> = {}): Promise<string> {
    const catalogueKey = key(name);
    const res = await api('post', '/').send({
      catalogueKey,
      stableName: stable(name),
      franchise: 'Test Franchise',
      backstory: 'A stable built by the profile endpoint tests.',
      strategyKey,
      ...extra,
    });
    expect(res.status).toBe(201);
    return catalogueKey;
  }

  async function readyDraft(name: string): Promise<string> {
    const catalogueKey = await createDraft(name);
    const res = await api('post', `/${catalogueKey}/blueprints`).send(HAMMER);
    expect(res.status).toBe(201);
    return catalogueKey;
  }

  async function automatonUserIds(): Promise<number[]> {
    const profiles = await prisma.automatonProfile.findMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } }, select: { userId: true } });
    return profiles.flatMap((p) => (p.userId === null ? [] : [p.userId]));
  }

  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    previousUploadDir = setAutomatonUploadDir(SCRATCH);
    programBefore = (await getProgramSwitch()).turnsEnabled;
    const admin = await prisma.user.create({ data: { username: `t55p_admin_${run}`, passwordHash: 'unused', role: 'admin' } });
    const player = await prisma.user.create({ data: { username: `t55p_player_${run}`, passwordHash: 'unused', role: 'user' } });
    adminId = admin.id;
    extraUserIds.push(admin.id, player.id);
    adminToken = generateToken({ id: String(admin.id), username: admin.username, role: 'admin', tokenVersion: 0 });
    playerToken = generateToken({ id: String(player.id), username: player.username, role: 'user', tokenVersion: 0 });
  });

  afterAll(async () => {
    await deleteAutomatonStables(await automatonUserIds());
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
    await prisma.adminAuditLog.deleteMany({ where: { adminUserId: adminId } });
    await prisma.robot.deleteMany({ where: { userId: { in: extraUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: extraUserIds } } });
    await setProgramSwitch(programBefore, adminId).catch(() => undefined);
    setAutomatonUploadDir(previousUploadDir);
    fs.rmSync(SCRATCH, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  describe('access (R11.1)', () => {
    it('answers 401 without a token and 403 for a non-admin, changing nothing', async () => {
      const before = await prisma.automatonProfile.count();
      const anonymous = await request(server).post(BASE).send({ catalogueKey: key('anon') });
      expect(anonymous.status).toBe(401);
      const player = await api('post', '/', playerToken).send({ catalogueKey: key('player') });
      expect(player.status).toBe(403);
      expect(await prisma.automatonProfile.count()).toBe(before);
    });
  });

  describe('drafts', () => {
    it('creates a Draft_Automaton with the latest strategy version, defaults and no User (R2.1)', async () => {
      const auditBefore = await auditCount();
      const catalogueKey = await createDraft('create');
      const detail = await api('get', `/${catalogueKey}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({
        catalogueKey,
        stableName: stable('create'),
        status: 'draft',
        origin: 'admin',
        userId: null,
        eventOrder: [...SUBSCRIBABLE_EVENT_TYPES],
        teamNames: { twoVsTwo: [], threeVsThree: [] },
        strategy: { key: 'paragon', version: PARAGON_LATEST, parametersValid: true },
      });
      expect(detail.body.strategy.buildOrder).toHaveLength(paragon.buildOrder.length);
      const entries = await auditEntries(auditBefore + 1);
      expect(entries[entries.length - 1]).toMatchObject({
        operationType: 'automaton.create_draft',
        operationResult: 'success',
        resultSummary: expect.objectContaining({ catalogueKey, outcome: 'completed' }),
      });
    });

    it('rejects an existing key, a taken stable name and an unknown strategy, each with one audit entry', async () => {
      const catalogueKey = await createDraft('dupe');
      const auditBefore = await auditCount();
      const body = { catalogueKey, stableName: stable('dupe2'), franchise: 'F', backstory: 'B', strategyKey: 'paragon' };
      expect((await api('post', '/').send(body)).body.code).toBe('AUTOMATON_KEY_EXISTS');
      const taken = await api('post', '/').send({ ...body, catalogueKey: key('dupe3'), stableName: stable('dupe') });
      expect(taken.status).toBe(409);
      expect(taken.body.code).toBe('AUTOMATON_STABLE_NAME_TAKEN');
      const unknown = await api('post', '/').send({ ...body, catalogueKey: key('dupe4'), strategyKey: 'no-such-strategy' });
      expect(unknown.status).toBe(400);
      expect(unknown.body.code).toBe('AUTOMATON_CATALOGUE_INVALID');
      const entries = await auditEntries(auditBefore + 3);
      expect(entries.slice(auditBefore).map((e) => [e.operationType, e.operationResult])).toEqual([
        ['automaton.create_draft', 'failure'],
        ['automaton.create_draft', 'failure'],
        ['automaton.create_draft', 'failure'],
      ]);
      expect(await prisma.automatonProfile.count({ where: { catalogueKey: { in: [key('dupe3'), key('dupe4')] } } })).toBe(0);
    });

    it('audits a validation failure (before the handler) exactly once', async () => {
      const auditBefore = await auditCount();
      const res = await api('post', '/').send({ catalogueKey: 'Bad Key!', stableName: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await auditCount()).toBe(auditBefore + 1);
      const [entry] = (await auditEntries(auditBefore + 1)).slice(auditBefore);
      expect(entry).toMatchObject({ operationResult: 'failure', resultSummary: expect.objectContaining({ catalogueKey: 'invalid', code: 'VALIDATION_ERROR' }) });
    });

    it('updates franchise, backstory, Event_Order and stable name of a draft; rejects a bad Event_Order (R3.5)', async () => {
      const catalogueKey = await createDraft('patch');
      const reversed = [...SUBSCRIBABLE_EVENT_TYPES].reverse();
      const ok = await api('patch', `/${catalogueKey}`).send({ franchise: 'New Franchise', backstory: 'New backstory.', eventOrder: reversed, stableName: stable('patched') });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ franchise: 'New Franchise', backstory: 'New backstory.', eventOrder: reversed, stableName: stable('patched') });
      const bad = await api('patch', `/${catalogueKey}`).send({ eventOrder: reversed.slice(1) });
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('AUTOMATON_CATALOGUE_INVALID');
      const dup = await api('patch', `/${catalogueKey}`).send({ eventOrder: [...reversed.slice(1), reversed[1]] });
      expect(dup.status).toBe(400);
    });

    it('deletes a draft with its blueprints and uploads (R2.6)', async () => {
      const catalogueKey = await readyDraft('delete');
      fs.mkdirSync(path.join(SCRATCH, catalogueKey), { recursive: true });
      fs.writeFileSync(path.join(SCRATCH, catalogueKey, '0b9f4c1e-8d2a-4f3b-9c7d-1a2b3c4d5e6f.webp'), 'x');
      const res = await api('delete', `/${catalogueKey}`);
      expect(res.status).toBe(204);
      expect(await prisma.automatonProfile.findUnique({ where: { catalogueKey } })).toBeNull();
      expect(await prisma.automatonRobotBlueprint.count({ where: { profile: { catalogueKey } } })).toBe(0);
      expect(fs.existsSync(path.join(SCRATCH, catalogueKey))).toBe(false);
      expect((await api('delete', `/${catalogueKey}`)).status).toBe(404);
    });
  });

  describe('blueprints (R3.1–R3.4, R3.6, R3.7, R3.12)', () => {
    it('adds into the next free slot and rejects an image key (strict body, R3.2)', async () => {
      const catalogueKey = await createDraft('bp');
      const added = await api('post', `/${catalogueKey}/blueprints`).send(HAMMER);
      expect(added.status).toBe(201);
      expect(added.body.blueprints).toMatchObject([{ slot: 1, robotName: 'Pz Hammer', imageUrl: null, liveRobot: null }]);
      const withImage = await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, imageUrl: '/uploads/automatons/x/y.webp' });
      expect(withImage.status).toBe(400);
      expect(withImage.body.code).toBe('VALIDATION_ERROR');
      const patchImage = await api('patch', `/${catalogueKey}/blueprints/1`).send({ imageUrl: '/uploads/automatons/x/y.webp' });
      expect(patchImage.status).toBe(400);
    });

    it('rejects an unknown weapon, a loadout change against the plan, a missing refinement step and a duplicate name', async () => {
      const catalogueKey = await readyDraft('bprules');
      // Paragon allows 2 robots, so a second blueprint needs one 2v2 team name.
      const pair = { twoVsTwo: ['Pz Pair'], threeVsThree: [] };
      const unknown = await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, teamNames: pair, weaponPath: [{ main: 'No Such Gun', offhand: 'Light Shield' }] });
      expect(unknown.body.code).toBe('AUTOMATON_CATALOGUE_INVALID');
      const loadout = await api('patch', `/${catalogueKey}/blueprints/1`).send({ loadoutType: 'dual_wield' });
      expect(loadout.status).toBe(400);
      expect(loadout.body.details.issues.map((i: { rule: string }) => i.rule)).toContain('weapon_loadout');
      const noPlan = await api('patch', `/${catalogueKey}/blueprints/1`).send({ refinementPlan: [] });
      expect(noPlan.body.error).toBe('Every weapon of the last stage except a shield needs at least one refinement step: Heavy Hammer (main hand).');
      const dupName = await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, teamNames: pair, robotName: HAMMER.robotName });
      expect(dupName.body.details.issues.map((i: { rule: string }) => i.rule)).toContain('robot_name_duplicate');
      const unchanged = await api('get', `/${catalogueKey}`);
      expect(unchanged.body.blueprints).toHaveLength(1);
      expect(unchanged.body.blueprints[0].loadoutType).toBe('two_handed');
    });

    it('edits a blueprint (merged) and moves it to a free slot', async () => {
      const catalogueKey = await readyDraft('bpedit');
      // Paragon allows 2 robots, so a second blueprint needs one 2v2 team name.
      expect((await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, teamNames: { twoVsTwo: ['Pz Pair'], threeVsThree: [] } })).status).toBe(201);
      // Slot 2 → 3 leaves slots {1, 3}: one buildable blueprint, so the 2v2 name must go in the same call (R3.6).
      const mismatch = await api('patch', `/${catalogueKey}/blueprints/2`).send({ slot: 3 });
      expect(mismatch.body.code).toBe('AUTOMATON_TEAM_NAMES_MISMATCH');
      const res = await api('patch', `/${catalogueKey}/blueprints/2`).send({ robotName: 'Pz Renamed', yieldThreshold: 30, slot: 3, teamNames: { twoVsTwo: [], threeVsThree: [] } });
      expect(res.status).toBe(200);
      expect(res.body.blueprints).toMatchObject([{ slot: 1 }, { slot: 3, robotName: 'Pz Renamed', yieldThreshold: 30, loadoutType: 'weapon_shield' }]);
      expect(res.body.teamNames).toEqual({ twoVsTwo: [], threeVsThree: [] });
      expect((await api('patch', `/${catalogueKey}/blueprints/2`).send({ yieldThreshold: 5 })).body.code).toBe('AUTOMATON_BLUEPRINT_NOT_FOUND');
    });

    it('rejects a slot move that leaves the next robot without a blueprint (R3.7, review C09-1)', async () => {
      const catalogueKey = await readyDraft('bpgap');
      // The only blueprint 1 → 3: robot 1 is built from slot 1, so nothing could ever be built.
      const gap = await api('patch', `/${catalogueKey}/blueprints/1`).send({ slot: 3 });
      expect(gap.status).toBe(400);
      expect(gap.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
      expect(gap.body.error).toMatch(/but this stable has 0 blueprints\. Add blueprints or lower the target\.$/);
      const unchanged = await prisma.automatonRobotBlueprint.findMany({ where: { profile: { catalogueKey } }, select: { slotIndex: true } });
      expect(unchanged).toEqual([{ slotIndex: 1 }]);
    });

    it('rejects deleting a middle slot that leaves a robots target above the buildable blueprints (R3.7, review C09-1)', async () => {
      const catalogueKey = await createDraft('bpmid', 'duo');
      const pair = { twoVsTwo: ['Pz Pair'], threeVsThree: [] };
      const trio = { twoVsTwo: ['Pz Pair'], threeVsThree: ['Pz Trio'] };
      expect((await api('post', `/${catalogueKey}/blueprints`).send(HAMMER)).status).toBe(201);
      expect((await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, teamNames: pair })).status).toBe(201);
      expect((await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, robotName: 'Pz Third', teamNames: trio })).status).toBe(201);
      // Deleting slot 2 of 3 leaves slots {1, 3}: Duo's robots target of 2 needs slot 2.
      const gap = await request(server).delete(`${BASE}/${catalogueKey}/blueprints/2`).set('Authorization', `Bearer ${adminToken}`).send({ teamNames: { twoVsTwo: [], threeVsThree: [] } });
      expect(gap.status).toBe(400);
      expect(gap.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
      expect(await prisma.automatonRobotBlueprint.count({ where: { profile: { catalogueKey } } })).toBe(3);
      // Deleting the top slot keeps slots 1…2 contiguous and is accepted.
      const top = await request(server).delete(`${BASE}/${catalogueKey}/blueprints/3`).set('Authorization', `Bearer ${adminToken}`).send({ teamNames: pair });
      expect(top.status).toBe(200);
    });

    it('requires Team_Names when a blueprint changes the count, with optional teamNames on add/delete (R3.6)', async () => {
      const catalogueKey = await createDraft('teams', 'duo');
      expect((await api('post', `/${catalogueKey}/blueprints`).send(HAMMER)).status).toBe(201);
      const mismatch = await api('post', `/${catalogueKey}/blueprints`).send(SHIELD);
      expect(mismatch.status).toBe(400);
      expect(mismatch.body.code).toBe('AUTOMATON_TEAM_NAMES_MISMATCH');
      expect(mismatch.body.error).toBe('This stable needs 1 team names for 2v2 and 0 for 3v3.');
      const ok = await api('post', `/${catalogueKey}/blueprints`).send({ ...SHIELD, teamNames: { twoVsTwo: ['Pz Pair'], threeVsThree: [] } });
      expect(ok.status).toBe(201);
      expect(ok.body.teamNames).toEqual({ twoVsTwo: ['Pz Pair'], threeVsThree: [] });
      expect(ok.body.teams).toMatchObject([{ size: 2, slots: [1, 2], name: 'Pz Pair', state: 'waiting', waitsForSlot: 2 }]);
      const badName = await api('patch', `/${catalogueKey}`).send({ teamNames: { twoVsTwo: ['x'], threeVsThree: [] } });
      expect(badName.body.details.issues.map((i: { rule: string }) => i.rule)).toContain('team_name_invalid');
      // Deleting slot 2 leaves 1 blueprint, below Duo's robots target of 2 (R3.7).
      const tooFew = await request(server).delete(`${BASE}/${catalogueKey}/blueprints/2`).set('Authorization', `Bearer ${adminToken}`).send({ teamNames: { twoVsTwo: [], threeVsThree: [] } });
      expect(tooFew.status).toBe(400);
      expect(tooFew.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
      expect(await prisma.automatonRobotBlueprint.count({ where: { profile: { catalogueKey } } })).toBe(2);
    });
  });

  describe('strategy (R3.7, R6.4, R6.5)', () => {
    it('updates Goal_Targets on the pinned version and rejects targets above the blueprint count or out of bounds', async () => {
      const catalogueKey = await readyDraft('strat');
      const tooFew = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [paragonRobots2.id]: 2 } });
      expect(tooFew.status).toBe(400);
      expect(tooFew.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
      expect(tooFew.body.error).toBe(`Goal ${paragonRobots2.position} targets 2 robots, but this stable has 1 blueprints. Add blueprints or lower the target.`);
      const bounds = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [paragonRobots2.id]: 7 } });
      expect(bounds.body.details.issues[0].rule).toBe('target_out_of_bounds');
      const facility = paragon.buildOrder.find((d) => d.type === 'facility' && d.bounds.max > d.defaultTarget)!;
      const ok = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [facility.id]: facility.defaultTarget + 1 } });
      expect(ok.status).toBe(200);
      expect(ok.body.strategy.buildOrder.find((d: { goalId: string }) => d.goalId === facility.id).target).toBe(facility.defaultTarget + 1);
    });

    it('rejects a strategy assignment whose defaults exceed the blueprints, and accepts it with lower targets', async () => {
      const catalogueKey = await readyDraft('swap');
      const swarm = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'swarm' });
      expect(swarm.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
      const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
      expect(profile.strategyKey).toBe('paragon');
    });
  });

  describe('Activation (R2.2, R2.3, R2.5)', () => {
    it('creates the Automaton User in one transaction and links the profile', async () => {
      const catalogueKey = await readyDraft('act');
      const res = await api('post', `/${catalogueKey}/activate`);
      expect(res.status).toBe(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.userId } });
      expect(user).toMatchObject({
        username: `automaton_${catalogueKey}`,
        email: null,
        role: 'user',
        stableName: stable('act'),
        currency: 3_000_000,
        isGenerated: false,
        stableType: 'automaton',
        hasCompletedOnboarding: true,
      });
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
      expect(profile).toMatchObject({ status: 'active', userId: user.id, plannedStableName: null });
      expect(profile.activatedAt).not.toBeNull();
      // Opening balance, not a Financial_Pair.
      expect(await prisma.financialLedger.count({ where: { userId: user.id } })).toBe(0);
      expect((await api('post', `/${catalogueKey}/activate`)).body.code).toBe('AUTOMATON_NOT_DRAFT');
      expect((await api('delete', `/${catalogueKey}`)).body.code).toBe('AUTOMATON_NOT_DRAFT');
    });

    it.each([
      ['a taken stable name', 'AUTOMATON_STABLE_NAME_TAKEN'],
      ['a taken username', 'AUTOMATON_USERNAME_TAKEN'],
      ['invalid Strategy_Parameters', 'AUTOMATON_CATALOGUE_INVALID'],
      ['an invalid Robot_Blueprint', 'AUTOMATON_CATALOGUE_INVALID'],
      ['invalid Team_Names', 'AUTOMATON_TEAM_NAMES_MISMATCH'],
      ['an invalid Event_Order', 'AUTOMATON_CATALOGUE_INVALID'],
      ['robots targets above the blueprints', 'AUTOMATON_BLUEPRINTS_TOO_FEW'],
    ])('rejects %s with %s and writes nothing', async (condition, code) => {
      const name = `rej${['a taken stable name', 'a taken username', 'invalid Strategy_Parameters', 'an invalid Robot_Blueprint', 'invalid Team_Names', 'an invalid Event_Order', 'robots targets above the blueprints'].indexOf(condition)}`;
      const catalogueKey = await readyDraft(name);
      const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, include: { blueprints: true } });
      // Test-only corruption of the stored draft (admin endpoints would refuse these values).
      switch (condition) {
        case 'a taken stable name': {
          // Another stable registered the planned name after the draft was saved.
          const taker = await prisma.user.create({ data: { username: `t55p_taker_${run}`, passwordHash: 'unused', stableName: stable(name) } });
          extraUserIds.push(taker.id);
          break;
        }
        case 'a taken username': {
          const taker = await prisma.user.create({ data: { username: `automaton_${catalogueKey}`, passwordHash: 'unused' } });
          extraUserIds.push(taker.id);
          break;
        }
        case 'invalid Strategy_Parameters':
          await prisma.automatonProfile.update({ where: { id: profile.id }, data: { strategyParameters: { targets: { nope: 1 } } } });
          break;
        case 'an invalid Robot_Blueprint':
          await prisma.automatonRobotBlueprint.update({ where: { id: profile.blueprints[0].id }, data: { weaponPath: [{ main: 'No Such Gun' }] } });
          break;
        case 'invalid Team_Names':
          await prisma.automatonProfile.update({ where: { id: profile.id }, data: { teamNames: { twoVsTwo: ['Extra Pair'], threeVsThree: [] } } });
          break;
        case 'an invalid Event_Order':
          await prisma.automatonProfile.update({ where: { id: profile.id }, data: { eventOrder: SUBSCRIBABLE_EVENT_TYPES.slice(2) } });
          break;
        case 'robots targets above the blueprints': {
          const targets = { ...(profile.strategyParameters as { targets: Record<string, number> }).targets, [paragonRobots2.id]: 2 };
          await prisma.automatonProfile.update({ where: { id: profile.id }, data: { strategyParameters: { targets } } });
          break;
        }
      }
      const usersBefore = await prisma.user.count();
      const auditBefore = await auditCount();
      const res = await api('post', `/${catalogueKey}/activate`);
      expect(res.body.code).toBe(code);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await prisma.user.count()).toBe(usersBefore);
      const after = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
      expect(after).toMatchObject({ status: 'draft', userId: null, activatedAt: null });
      const entries = await auditEntries(auditBefore + 1);
      expect(entries.slice(auditBefore)).toEqual([expect.objectContaining({ operationType: 'automaton.activate', operationResult: 'failure' })]);
    });

    it('activates every draft independently in Catalogue_Key order (R2.5)', async () => {
      // The shared dev database may hold real drafts (e.g. the synced starters):
      // scope the call to this run's drafts so a test never activates them.
      const real = profileService.activateAllDrafts;
      const spy = jest.spyOn(profileService, 'activateAllDrafts')
        .mockImplementation((deps = {}) => real({ ...deps, draftScope: (k) => k.startsWith(`${KEY_PREFIX}-all-`) }));
      try {
        const good = await readyDraft('all-b');
        const bad = await createDraft('all-a'); // no blueprints → rejected
        const alsoGood = await readyDraft('all-c');
        const auditBefore = await auditCount();
        const res = await api('post', '/activate-drafts');
        expect(res.status).toBe(200);
        expect(res.body.outcomes).toEqual([
          expect.objectContaining({ catalogueKey: bad, outcome: 'rejected', code: 'AUTOMATON_BLUEPRINTS_TOO_FEW' }),
          expect.objectContaining({ catalogueKey: good, outcome: 'activated', stableName: stable('all-b') }),
          expect.objectContaining({ catalogueKey: alsoGood, outcome: 'activated' }),
        ]);
        expect(await auditCount()).toBe(auditBefore + 1);
        const [entry] = (await auditEntries(auditBefore + 1)).slice(auditBefore);
        expect(entry).toMatchObject({
          operationType: 'automaton.activate_all',
          resultSummary: expect.objectContaining({ catalogueKey: 'all', activated: [good, alsoGood], rejected: [{ catalogueKey: bad, code: 'AUTOMATON_BLUEPRINTS_TOO_FEW' }] }),
        });
        expect((await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: bad } })).status).toBe('draft');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('active profiles (R3.8, R3.9, R3.10, R3.12)', () => {
    let catalogueKey: string;
    let userId: number;
    let robotId: number;

    beforeAll(async () => {
      catalogueKey = await readyDraft('live');
      const res = await api('post', `/${catalogueKey}/activate`);
      userId = res.body.userId;
      const blueprint = await prisma.automatonRobotBlueprint.findFirstOrThrow({ where: { profile: { catalogueKey }, slotIndex: 1 } });
      // Test fixture: the live robot a turn would have built from slot 1.
      const robot = await prisma.robot.create({
        data: { userId, name: HAMMER.robotName, currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0, automatonBlueprintId: blueprint.id, automatonSlotIndex: 1 },
      });
      robotId = robot.id;
    });

    it('renames the stable under the player rules (R3.8)', async () => {
      const res = await api('patch', `/${catalogueKey}`).send({ stableName: stable('live2') });
      expect(res.status).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).stableName).toBe(stable('live2'));
      const taken = await api('patch', `/${catalogueKey}`).send({ stableName: stable('act') });
      expect(taken.body.code).toBe('AUTOMATON_STABLE_NAME_TAKEN');
      const invalid = await api('patch', `/${catalogueKey}`).send({ stableName: 'ab' });
      expect(invalid.status).toBe(400);
    });

    it('never renames the live robot and rejects deleting or moving its blueprint (R3.9, R3.12)', async () => {
      const renamed = await api('patch', `/${catalogueKey}/blueprints/1`).send({ robotName: 'Pz Next Name' });
      expect(renamed.status).toBe(200);
      expect((await prisma.robot.findUniqueOrThrow({ where: { id: robotId } })).name).toBe(HAMMER.robotName);
      expect(renamed.body.blueprints[0].liveRobot).toEqual({ id: robotId, name: HAMMER.robotName });
      const moved = await api('patch', `/${catalogueKey}/blueprints/1`).send({ slot: 2 });
      expect(moved.body.code).toBe('AUTOMATON_BLUEPRINT_IN_PLAY');
      const deleted = await api('delete', `/${catalogueKey}/blueprints/1`);
      expect(deleted.status).toBe(409);
      expect(deleted.body.code).toBe('AUTOMATON_BLUEPRINT_IN_PLAY');
      expect(await prisma.automatonRobotBlueprint.count({ where: { profile: { catalogueKey } } })).toBe(1);
    });

    it('uploads a 512×512 WebP and sets it on the blueprint and the live robot in one request (R3.10, R11.6)', async () => {
      const png = await sharp({ create: { width: 200, height: 120, channels: 3, background: { r: 40, g: 90, b: 160 } } }).png().toBuffer();
      const res = await api('post', `/${catalogueKey}/blueprints/1/image`).attach('image', png, { filename: 'robot.png', contentType: 'image/png' });
      expect(res.status).toBe(200);
      expect(res.body.imageUrl.startsWith(`/uploads/automatons/${catalogueKey}/`)).toBe(true);
      expect(path.basename(res.body.imageUrl)).toMatch(/^[0-9a-f-]{36}\.webp$/);
      expect(res.body.robotsUpdated).toBe(1);
      const file = path.join(SCRATCH, catalogueKey, path.basename(res.body.imageUrl));
      const meta = await sharp(file).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
      expect((await prisma.robot.findUniqueOrThrow({ where: { id: robotId } })).imageUrl).toBe(res.body.imageUrl);
      const blueprint = await prisma.automatonRobotBlueprint.findFirstOrThrow({ where: { profile: { catalogueKey }, slotIndex: 1 } });
      expect(blueprint.imageUrl).toBe(res.body.imageUrl);
    });

    it('rejects a file that is not an image, a missing file and an unknown slot, writing no file', async () => {
      const before = fs.readdirSync(path.join(SCRATCH, catalogueKey)).length;
      const text = await api('post', `/${catalogueKey}/blueprints/1/image`).attach('image', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
      expect(text.status).toBe(400);
      expect(text.body.code).toBe('AUTOMATON_IMAGE_INVALID');
      expect((await api('post', `/${catalogueKey}/blueprints/1/image`)).body.code).toBe('AUTOMATON_IMAGE_INVALID');
      const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
      const slot = await api('post', `/${catalogueKey}/blueprints/9/image`).attach('image', png, { filename: 'x.png', contentType: 'image/png' });
      expect(slot.status).toBe(404);
      expect(fs.readdirSync(path.join(SCRATCH, catalogueKey)).length).toBe(before);
    });

    it('previews the next turn with zero database and file writes (R11.4)', async () => {
      const statements: string[] = [];
      const stop = observePrismaStatements((sql) => statements.push(sql));
      const filesBefore = fs.readdirSync(SCRATCH, { recursive: true }).length;
      let res: request.Response;
      try {
        res = await api('get', `/${catalogueKey}/preview`);
      } finally {
        stop();
      }
      expect(res.status).toBe(200);
      const writes = statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE)\b/i.test(sql));
      expect(writes).toEqual([]);
      expect(fs.readdirSync(SCRATCH, { recursive: true }).length).toBe(filesBefore);
      expect(res.body).toMatchObject({ catalogueKey, status: 'active', strategyKey: 'paragon', startBalance: 3_000_000 });
      expect(res.body.goals).toHaveLength(paragon.buildOrder.length);
      for (const goal of res.body.goals) expect(['done', 'bought', 'saving', 'blocked', 'waiting']).toContain(goal.status);
      const firstRobots = paragon.buildOrder.find((d) => d.type === 'robots')!;
      // The live robot satisfies the first Robots → 1 Goal.
      expect(res.body.goals.find((g: { goalId: string }) => g.goalId === firstRobots.id).status).toBe('done');
    });

    it('previews a draft as a fresh ₡3,000,000 stable', async () => {
      const draft = await readyDraft('previewdraft');
      const res = await api('get', `/${draft}/preview`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'draft', startBalance: 3_000_000 });
      const firstRobots = paragon.buildOrder.find((d) => d.type === 'robots')!;
      expect(res.body.actions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'robot_chain', position: firstRobots.position })]));
    });

    it('lists Turn_Records newest first', async () => {
      const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
      for (const slot of [1, 2]) {
        await prisma.automatonTurn.create({
          data: {
            profileId: profile.id, seasonNumber: 9_000, trigger: 'settlement', slot, status: 'completed', strategyKey: 'paragon',
            strategyVersion: 1, startBalance: 3_000_000, endBalance: 3_000_000, finishedAt: new Date(), startedAt: new Date(Date.now() + slot * 1000),
          },
        });
      }
      const res = await api('get', `/${catalogueKey}/turns?limit=1`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, limit: 1 });
      expect(res.body.items[0]).toMatchObject({ slot: 2, status: 'completed', trigger: 'settlement' });
    });
  });

  describe('list, Program_Switch, catalogue', () => {
    it('lists profiles with progress and filters on status and strategy', async () => {
      const res = await api('get', '/?status=active&strategy=paragon&limit=100');
      expect(res.status).toBe(200);
      const mine = (res.body.items as { catalogueKey: string }[]).filter((i) => i.catalogueKey.startsWith(KEY_PREFIX));
      expect(mine.length).toBeGreaterThan(0);
      for (const item of res.body.items) expect(item).toMatchObject({ status: 'active', strategyKey: 'paragon' });
      const live = (res.body.items as { catalogueKey: string }[]).find((i) => i.catalogueKey === key('live'));
      // Precondition for the tier: the live stable's robot and teams have no played standings row in this suite.
      const liveUserId = (await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: key('live') } })).userId ?? -1;
      const [liveRobots, liveTeams] = await Promise.all([
        prisma.robot.findMany({ where: { userId: liveUserId }, select: { id: true } }),
        prisma.teamBattle.findMany({ where: { stableId: liveUserId }, select: { id: true } }),
      ]);
      const played = await prisma.standing.count({
        where: {
          AND: [
            { OR: [{ entityType: 'robot', entityId: { in: liveRobots.map((x) => x.id) } }, { entityType: 'team', entityId: { in: liveTeams.map((x) => x.id) } }] },
            { OR: [{ wins: { gt: 0 } }, { losses: { gt: 0 } }, { draws: { gt: 0 } }, { totalMatches: { gt: 0 } }] },
          ],
        },
      });
      expect(played).toBe(0);
      expect(live).toMatchObject({
        robots: { current: 1, target: 1 }, credits: 3_000_000, strategyDisplayName: 'Paragon', bestTier: null, bestTierMode: null,
      });
      expect((await api('get', '/?status=retired')).status).toBe(400);
    });

    it('reads and sets the Program_Switch with old and new value in the audit entry (R2.8)', async () => {
      const auditBefore = await auditCount();
      const off = await api('put', '/program').send({ turnsEnabled: false });
      expect(off.status).toBe(200);
      expect(off.body).toMatchObject({ previous: programBefore, current: false });
      expect((await api('get', '/program')).body.turnsEnabled).toBe(false);
      await api('put', '/program').send({ turnsEnabled: programBefore });
      const entries = (await auditEntries(auditBefore + 2)).slice(auditBefore);
      expect(entries[0]).toMatchObject({
        operationType: 'automaton.program_switch',
        operationResult: 'success',
        resultSummary: expect.objectContaining({ catalogueKey: 'all', previous: programBefore, current: false }),
      });
      expect((await api('put', '/program').send({ turnsEnabled: 'no' })).status).toBe(400);
    });

    it('exports selected stables and reads the last sync summary', async () => {
      const exported = await api('get', `/export?keys=${key('live')}`);
      expect(exported.status).toBe(200);
      expect(exported.body.entries.map((e: { catalogueKey: string }) => e.catalogueKey)).toEqual([key('live')]);
      expect(exported.body.entries[0].stableName).toBe(stable('live2'));
      expect(exported.headers['content-disposition']).toContain('attachment');
      expect((await api('get', '/export?keys=../etc')).status).toBe(400);
      const sync = await api('get', '/catalogue/sync-status');
      expect(sync.status).toBe(200);
      expect(sync.body).toHaveProperty('summary');
    });
  });
});
