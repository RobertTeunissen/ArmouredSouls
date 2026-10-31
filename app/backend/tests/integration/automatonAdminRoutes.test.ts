/**
 * Spec #55 task 9.5 — the complete Admin_Automaton_Control route table
 * against the real database (R2.2–R2.6, R3.5–R3.12, R6.4, R6.5,
 * R11.1–R11.5, R14.3).
 *
 * - The route table is exactly design §17.1: no route runs a turn, deletes
 *   an active stable, edits live robots, teams, subscriptions or weapons or
 *   changes a balance (R2.4, R11.5).
 * - Every endpoint answers 401 without a token and 403 for a non-admin, with
 *   no data change (R11.1).
 * - Every mutation records exactly one audit entry when it completes and
 *   exactly one when it is rejected (R11.3).
 * - Activation success and its Team_Names, Event_Order and R3.7 rejections;
 *   strategy edits validated and applied from the next turn; a robots
 *   Goal_Target above the blueprints rejected on parameter update, strategy
 *   assignment and blueprint deletion (R3.7).
 *
 * The profile suite (`automatonProfile.test.ts`) covers every other
 * Activation rejection, the blueprint rules and Turn_Preview's zero writes in
 * depth; the Strategy_Draft, upgrade and comparison suites cover theirs.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import adminAutomatonsRoutes from '../../src/routes/adminAutomatons';
import * as profileService from '../../src/services/automaton/automatonProfileService';
import { setAutomatonUploadDir } from '../../src/services/automaton/automatonImageService';
import { getProgramSwitch, setProgramSwitch } from '../../src/services/automaton/programSwitch';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../src/services/subscription/eventRegistry';
import { deleteAutomatonStables } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness, type HttpMethod } from '../helpers/automatonAdminApi';

const tag = runTag();
const KEY_PREFIX = `t55r-${tag}`;
const key = (name: string): string => `${KEY_PREFIX}-${name}`;
const stable = (name: string): string => `Rt ${name} ${tag}`.slice(0, 30);
const SCRATCH = path.join(__dirname, '.scratch-automaton-routes-uploads');

const HAMMER = {
  robotName: 'Rt Hammer',
  loadoutType: 'two_handed',
  stance: 'balanced',
  yieldThreshold: 10,
  buildFocus: 'bruiser',
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }, { tier: 'forge', hand: 'main', magnitude: 1 }],
};
const HAMMER_2 = { ...HAMMER, robotName: 'Rt Hammer Two' };

/** Design §17.1, in registration order (static paths before `/:key`). */
const ROUTE_TABLE: [string, string][] = [
  ['GET', '/status'],
  ['GET', '/strategies/comparison'],
  ['GET', '/strategies/economy'],
  ['GET', '/strategies'],
  ['POST', '/strategies/:key/upgrade'],
  ['GET', '/strategy-drafts'],
  ['POST', '/strategy-drafts'],
  ['GET', '/strategy-drafts/:id'],
  ['PUT', '/strategy-drafts/:id'],
  ['DELETE', '/strategy-drafts/:id'],
  ['POST', '/strategy-drafts/:id/preview'],
  ['GET', '/strategy-drafts/:id/export'],
  ['GET', '/program'],
  ['PUT', '/program'],
  ['GET', '/export'],
  ['GET', '/catalogue/sync-status'],
  ['POST', '/activate-drafts'],
  ['GET', '/'],
  ['POST', '/'],
  ['GET', '/:key'],
  ['PATCH', '/:key'],
  ['DELETE', '/:key'],
  ['PUT', '/:key/strategy'],
  ['POST', '/:key/blueprints'],
  ['PATCH', '/:key/blueprints/:slot'],
  ['DELETE', '/:key/blueprints/:slot'],
  ['POST', '/:key/blueprints/:slot/image'],
  ['POST', '/:key/activate'],
  ['GET', '/:key/preview'],
  ['GET', '/:key/cashflow'],
  ['GET', '/:key/turns'],
];

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

function registeredRoutes(): [string, string][] {
  const stack = (adminAutomatonsRoutes as unknown as { stack: RouteLayer[] }).stack;
  return stack.flatMap((layer) => (layer.route
    ? Object.keys(layer.route.methods).filter((m) => m !== '_all').map((m): [string, string] => [m.toUpperCase(), layer.route!.path])
    : []));
}

async function png(size: number): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 30, g: 120, b: 200 } } }).png().toBuffer();
}

describe('Admin_Automaton_Control route table (Spec #55 task 9.5)', () => {
  let harness: AdminApiHarness;
  let previousUploadDir: string;
  let programBefore: boolean;
  // The latest version: what a stable created on the admin page is pinned to.
  const paragon = getStrategyRegistry().getStrategy('paragon', getStrategyRegistry().latestVersion('paragon')!)!;
  const paragonRobots2 = paragon.buildOrder.find((d) => d.type === 'robots' && d.bounds.max === 2)!;

  const api = (method: HttpMethod, url: string, token?: string | null) => harness.api(method, url, token);

  /** Run a request and return the one audit entry it recorded (fails unless it recorded exactly one). */
  async function oneEntry(run: () => Promise<{ status: number }>): Promise<{ status: number; entry: { operationType: string; operationResult: string; resultSummary: unknown } }> {
    const before = await harness.settledAuditCount();
    const res = await run();
    const entries = (await harness.auditAtLeast(before + 1)).slice(before);
    expect(await harness.settledAuditCount()).toBe(before + 1);
    return { status: res.status, entry: entries[0] };
  }

  async function createDraft(name: string, strategyKey = 'paragon'): Promise<string> {
    const res = await api('post', '/').send({
      catalogueKey: key(name), stableName: stable(name), franchise: 'Route Tests', backstory: 'Built by the route-table tests.', strategyKey,
    });
    expect(res.status).toBe(201);
    return key(name);
  }

  async function readyDraft(name: string): Promise<string> {
    const catalogueKey = await createDraft(name);
    expect((await api('post', `/${catalogueKey}/blueprints`).send(HAMMER)).status).toBe(201);
    return catalogueKey;
  }

  async function snapshot(): Promise<string> {
    const [profiles, drafts, blueprints, turns, users, audit, program] = await Promise.all([
      prisma.automatonProfile.count(),
      prisma.automatonStrategyDraft.count(),
      prisma.automatonRobotBlueprint.count(),
      prisma.automatonTurn.count(),
      prisma.user.count(),
      prisma.adminAuditLog.count(),
      getProgramSwitch(),
    ]);
    return JSON.stringify({ profiles, drafts, blueprints, turns, users, audit, turnsEnabled: program.turnsEnabled, updatedAt: program.updatedAt });
  }

  beforeAll(async () => {
    harness = await startAdminApi(`rt${tag}`);
    previousUploadDir = setAutomatonUploadDir(SCRATCH);
    programBefore = (await getProgramSwitch()).turnsEnabled;
  });

  afterAll(async () => {
    const profiles = await prisma.automatonProfile.findMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } }, select: { userId: true } });
    await deleteAutomatonStables(profiles.flatMap((p) => (p.userId === null ? [] : [p.userId])));
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
    await prisma.automatonStrategyDraft.deleteMany({ where: { createdBy: harness.adminId } });
    await setProgramSwitch(programBefore, harness.adminId).catch(() => undefined);
    setAutomatonUploadDir(previousUploadDir);
    fs.rmSync(SCRATCH, { recursive: true, force: true });
    await harness.close();
    await prisma.$disconnect();
  });

  it('registers exactly the design §17.1 route table (R2.4, R11.2, R11.5)', () => {
    const routes = registeredRoutes();
    expect(routes).toEqual(ROUTE_TABLE);
    // Nothing runs a turn, changes a balance or edits live robots, teams, subscriptions or weapons.
    const forbidden = /turns?\/run|run-turn|balance|currency|credits|\/robots|\/teams|subscription|weapons/i;
    expect(routes.filter(([, p]) => forbidden.test(p))).toEqual([]);
    // The only DELETE of a stable is the draft deletion, which refuses an active stable (R2.6).
    expect(routes.filter(([m]) => m === 'DELETE').map(([, p]) => p)).toEqual(['/strategy-drafts/:id', '/:key', '/:key/blueprints/:slot']);
  });

  it('answers 401 without a token and 403 for a non-admin on every endpoint, changing nothing (R11.1)', async () => {
    const before = await snapshot();
    for (const [method, routePath] of ROUTE_TABLE) {
      const url = routePath.replace(':key', 'route-test-missing').replace(':slot', '1').replace(':id', '1');
      const verb = method.toLowerCase() as HttpMethod;
      const anonymous = await api(verb, url, null).send({});
      expect([method, routePath, anonymous.status]).toEqual([method, routePath, 401]);
      expect(anonymous.body).toMatchObject({ error: expect.any(String) });
      const player = await api(verb, url, harness.playerToken).send({});
      expect([method, routePath, player.status]).toEqual([method, routePath, 403]);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await snapshot()).toBe(before);
  });

  it('records exactly one audit entry for every rejected mutation (R11.3)', async () => {
    const rejections: [string, () => Promise<{ status: number }>][] = [
      ['program_switch', () => api('put', '/program').send({})],
      ['create_draft', () => api('post', '/').send({})],
      ['update_profile', () => api('patch', '/route-test-missing').send({ franchise: 'X' })],
      ['delete_draft', () => api('delete', '/route-test-missing')],
      ['update_strategy', () => api('put', '/route-test-missing/strategy').send({ strategyKey: 'paragon' })],
      ['add_blueprint', () => api('post', '/route-test-missing/blueprints').send(HAMMER)],
      ['update_blueprint', () => api('patch', '/route-test-missing/blueprints/1').send({ stance: 'defensive' })],
      ['delete_blueprint', () => api('delete', '/route-test-missing/blueprints/1')],
      ['upload_image', () => api('post', '/route-test-missing/blueprints/1/image')],
      ['activate', () => api('post', '/route-test-missing/activate')],
      ['strategy_draft_create', () => api('post', '/strategy-drafts').send({})],
      ['strategy_draft_update', () => api('put', '/strategy-drafts/999999999').send({ displayName: 'X' })],
      ['strategy_draft_delete', () => api('delete', '/strategy-drafts/999999999')],
      ['upgrade_strategy', () => api('post', '/strategies/duo/upgrade').send({ toVersion: 99, confirm: true })],
    ];
    for (const [operation, run] of rejections) {
      const { status, entry } = await oneEntry(run);
      expect([operation, status >= 400]).toEqual([operation, true]);
      expect(entry).toMatchObject({ operationType: `automaton.${operation}`, operationResult: 'failure', resultSummary: expect.objectContaining({ outcome: 'rejected' }) });
    }
  });

  it('records exactly one audit entry for every completed mutation (R11.3)', async () => {
    const catalogueKey = key('audit');
    const cases: [string, () => Promise<{ status: number }>][] = [
      ['create_draft', () => api('post', '/').send({ catalogueKey, stableName: stable('audit'), franchise: 'F', backstory: 'B', strategyKey: 'paragon' })],
      ['update_profile', () => api('patch', `/${catalogueKey}`).send({ franchise: 'Route Tests' })],
      ['add_blueprint', () => api('post', `/${catalogueKey}/blueprints`).send(HAMMER)],
      ['update_blueprint', () => api('patch', `/${catalogueKey}/blueprints/1`).send({ stance: 'defensive' })],
      ['upload_image', async () => api('post', `/${catalogueKey}/blueprints/1/image`).attach('image', await png(600), { filename: 'bot.png', contentType: 'image/png' })],
      ['update_strategy', () => api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: {} })],
      ['add_blueprint', () => api('post', `/${catalogueKey}/blueprints`).send({ ...HAMMER_2, teamNames: { twoVsTwo: ['Rt Pair'], threeVsThree: [] } })],
      ['delete_blueprint', () => api('delete', `/${catalogueKey}/blueprints/2`).send({ teamNames: { twoVsTwo: [], threeVsThree: [] } })],
      ['activate', () => api('post', `/${catalogueKey}/activate`)],
      ['program_switch', () => api('put', '/program').send({ turnsEnabled: programBefore })],
      ['upgrade_strategy', () => api('post', '/strategies/duo/upgrade').send({ toVersion: 1, confirm: true })],
    ];
    for (const [operation, run] of cases) {
      const { status, entry } = await oneEntry(run);
      expect([operation, status < 300]).toEqual([operation, true]);
      expect(entry).toMatchObject({ operationType: `automaton.${operation}`, operationResult: 'success' });
    }

    const toDelete = await createDraft('audit-del');
    const deleted = await oneEntry(() => api('delete', `/${toDelete}`));
    expect(deleted.entry).toMatchObject({ operationType: 'automaton.delete_draft', operationResult: 'success' });

    const draft = await oneEntry(() => api('post', '/strategy-drafts').send({ key: `troute-${tag}` }));
    expect(draft.entry.operationType).toBe('automaton.strategy_draft_create');
    const id = (draft.entry.resultSummary as { draftId: number }).draftId;
    expect((await oneEntry(() => api('put', `/strategy-drafts/${id}`).send({ displayName: 'Route draft' }))).entry.operationType).toBe('automaton.strategy_draft_update');
    expect((await oneEntry(() => api('delete', `/strategy-drafts/${id}`))).entry.operationType).toBe('automaton.strategy_draft_delete');

    // Activate-all, scoped to this run's drafts so the shared dev database's drafts are never activated.
    const real = profileService.activateAllDrafts;
    const spy = jest.spyOn(profileService, 'activateAllDrafts')
      .mockImplementation((deps = {}) => real({ ...deps, draftScope: (k) => k.startsWith(`${KEY_PREFIX}-all-`) }));
    try {
      await readyDraft('all-a');
      const all = await oneEntry(() => api('post', '/activate-drafts'));
      expect(all.entry).toMatchObject({ operationType: 'automaton.activate_all', resultSummary: expect.objectContaining({ catalogueKey: 'all', activated: [key('all-a')] }) });
    } finally {
      spy.mockRestore();
    }
  });

  describe('Activation (R2.2, R2.3)', () => {
    it('activates a ready draft as an Automaton User', async () => {
      const catalogueKey = await readyDraft('act');
      const res = await api('post', `/${catalogueKey}/activate`);
      expect(res.status).toBe(200);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: res.body.userId } })).toMatchObject({ stableType: 'automaton', isGenerated: false, currency: 3_000_000 });
    });

    it.each([
      ['Team_Names', 'AUTOMATON_TEAM_NAMES_MISMATCH', { teamNames: { twoVsTwo: ['Extra Pair'], threeVsThree: [] } }],
      ['Event_Order', 'AUTOMATON_CATALOGUE_INVALID', { eventOrder: SUBSCRIBABLE_EVENT_TYPES.slice(1) }],
      ['R3.7', 'AUTOMATON_BLUEPRINTS_TOO_FEW', null],
    ])('rejects a %s failure with %s, creating no User', async (name, code, corruption) => {
      const catalogueKey = await readyDraft(`rej-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
      const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
      // Test-only corruption of the stored draft (the admin endpoints refuse these values).
      const data = corruption ?? {
        strategyParameters: { targets: { ...(profile.strategyParameters as { targets: Record<string, number> }).targets, [paragonRobots2.id]: 2 } },
      };
      await prisma.automatonProfile.update({ where: { id: profile.id }, data: data as object });
      const usersBefore = await prisma.user.count();
      const { status, entry } = await oneEntry(() => api('post', `/${catalogueKey}/activate`));
      expect(status).toBeGreaterThanOrEqual(400);
      expect(entry).toMatchObject({ operationType: 'automaton.activate', operationResult: 'failure', resultSummary: expect.objectContaining({ code }) });
      expect(await prisma.user.count()).toBe(usersBefore);
      expect(await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } })).toMatchObject({ status: 'draft', userId: null });
    });
  });

  it('validates strategy edits and applies them from the next turn, touching no live state (R3.11, R6.4, R6.5)', async () => {
    const catalogueKey = await readyDraft('edit');
    const activated = await api('post', `/${catalogueKey}/activate`);
    expect(activated.status).toBe(200);
    const userBefore = await prisma.user.findUniqueOrThrow({ where: { id: activated.body.userId }, select: { currency: true, _count: { select: { robots: true } } } });

    const outOfBounds = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [paragonRobots2.id]: 5 } });
    expect(outOfBounds.status).toBe(400);
    const unknownGoal = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { 'paragon.v1.99.robots': 1 } });
    expect(unknownGoal.status).toBe(400);

    const booking = paragon.buildOrder.find((d) => d.type === 'facility' && d.facilityType === 'booking_office')!;
    const newTarget = booking.bounds.min === booking.defaultTarget ? booking.bounds.max : booking.bounds.min;
    const statements: string[] = [];
    const stop = observePrismaStatements((sql) => statements.push(sql));
    let res;
    try {
      res = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [booking.id]: newTarget } });
    } finally {
      stop();
    }
    expect(res.status).toBe(200);
    const stored = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } });
    expect((stored.strategyParameters as { targets: Record<string, number> }).targets[booking.id]).toBe(newTarget);
    // Only the profile row changes now; robots, teams, subscriptions and the balance change at the next turn.
    const written = statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
    expect(written.every((sql) => /automaton_profiles|admin_audit_log/i.test(sql))).toBe(true);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: activated.body.userId }, select: { currency: true, _count: { select: { robots: true } } } })).toEqual(userBefore);
    const preview = await api('get', `/${catalogueKey}/preview`);
    expect(preview.status).toBe(200);
    expect(preview.body.goals.find((g: { goalId: string }) => g.goalId === booking.id)).toMatchObject({ target: newTarget });
  });

  it('rejects a robots Goal_Target above the blueprints on parameter update, assignment and blueprint deletion (R3.7)', async () => {
    const catalogueKey = await readyDraft('r37');
    const update = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [paragonRobots2.id]: 2 } });
    expect(update.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
    const assignment = await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'trio' });
    expect(assignment.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');

    expect((await api('post', `/${catalogueKey}/blueprints`).send({ ...HAMMER_2, teamNames: { twoVsTwo: ['Rt Pair'], threeVsThree: [] } })).status).toBe(201);
    expect((await api('put', `/${catalogueKey}/strategy`).send({ strategyKey: 'paragon', targets: { [paragonRobots2.id]: 2 } })).status).toBe(200);
    const deletion = await api('delete', `/${catalogueKey}/blueprints/2`).send({ teamNames: { twoVsTwo: [], threeVsThree: [] } });
    expect(deletion.status).toBe(400);
    expect(deletion.body.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
    const after = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, include: { blueprints: true } });
    expect(after.strategyKey).toBe('paragon');
    expect(after.blueprints).toHaveLength(2);
  });
});
