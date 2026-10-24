/**
 * Spec #55 task 9.8 — Strategy_Library read and Strategy_Draft endpoints
 * against the real database (R6.9, R6.11, R6.13, R6.14, R11.2, R11.3,
 * design §14.0b, §17.1).
 */
import prisma from '../../src/lib/prisma';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { validateStrategyDefinition } from '../../src/services/automaton/strategies/strategyDefinitionSchema';
import { duoV1Definition } from '../../src/services/automaton/strategies/__tests__/helpers/upgradeFixtures';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();
const DRAFT_KEY = `tdraft-${tag}`;
const PROFILE_KEY = `t55d-${tag}-p`;

describe('Strategy_Library and Strategy_Drafts (Spec #55 task 9.8)', () => {
  let harness: AdminApiHarness;
  let draftId: number;

  beforeAll(async () => {
    harness = await startAdminApi(`drf${tag}`);
  });

  afterAll(async () => {
    await prisma.automatonStrategyDraft.deleteMany({ where: { createdBy: harness.adminId } });
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: PROFILE_KEY } });
    await harness.close();
    await prisma.$disconnect();
  });

  it('lists every strategy version with its numbered Build_Order and profile count (R6.9)', async () => {
    const res = await harness.api('get', '/strategies');
    expect(res.status).toBe(200);
    const registry = getStrategyRegistry();
    expect(res.body.strategies.map((s: { key: string }) => s.key)).toEqual([...registry.byKey.keys()].sort());
    const duo = res.body.strategies.find((s: { key: string }) => s.key === 'duo');
    const duoV1Count = await prisma.automatonProfile.count({ where: { strategyKey: 'duo', strategyVersion: 1 } });
    const duoCount = await prisma.automatonProfile.count({ where: { strategyKey: 'duo' } });
    expect(duo).toMatchObject({ key: 'duo', latestVersion: 2, profileCount: duoCount });
    // Versions oldest first.
    expect(duo.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(duo.versions[0]).toMatchObject({ version: 1, latest: false, profileCount: duoV1Count, displayName: registry.getStrategy('duo', 1)!.displayName });
    expect(duo.versions[1]).toMatchObject({ version: 2, latest: true });
    expect(duo.versions[0].buildOrder[1]).toMatchObject({
      position: 2,
      goalId: 'duo.v1.02.robots',
      label: 'Robots',
      defaultTarget: 2,
      bounds: { min: 1, max: 2 },
      buys: expect.stringContaining('Robot chain'),
    });
    expect((await harness.api('get', '/strategies', null)).status).toBe(401);
    expect((await harness.api('get', '/strategies', harness.playerToken)).status).toBe(403);
  });

  it('creates a blank draft (v1) with its validation and one audit entry', async () => {
    const auditBefore = await harness.settledAuditCount();
    const res = await harness.api('post', '/strategy-drafts').send({ key: DRAFT_KEY, displayName: 'Draft test' });
    expect(res.status).toBe(201);
    draftId = res.body.id;
    expect(res.body).toMatchObject({
      basedOn: null,
      definition: { schemaVersion: 1, key: DRAFT_KEY, version: 1, displayName: 'Draft test', buildOrder: [] },
      ready: false,
      upgradeWarning: null,
    });
    expect(res.body.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'goal_count', message: 'Add at least one goal.' }),
      expect.objectContaining({ rule: 'required_goal_type', message: 'Every strategy needs a Robots goal with a default above 0.' }),
    ]));
    const entries = (await harness.auditAtLeast(auditBefore + 1)).slice(auditBefore);
    expect(entries).toEqual([expect.objectContaining({
      operationType: 'automaton.strategy_draft_create',
      operationResult: 'success',
      resultSummary: expect.objectContaining({ catalogueKey: 'none', outcome: 'completed', draftId, strategyKey: DRAFT_KEY }),
    })]);
  });

  it('validates every update and returns errors per Goal and at Build_Order level (R6.10, R6.11)', async () => {
    const buildOrder = duoV1Definition().buildOrder;
    const valid = await harness.api('put', `/strategy-drafts/${draftId}`).send({ buildOrder, description: 'Two robots, then facilities.' });
    expect(valid.status).toBe(200);
    expect(valid.body).toMatchObject({ ready: true, errorCount: 0, issues: [] });

    const tooHigh = buildOrder.map((e) => (e.position === 3 ? { ...e, bounds: { min: 0, max: 7 } } : e));
    const perGoal = await harness.api('put', `/strategy-drafts/${draftId}`).send({ buildOrder: tooHigh });
    expect(perGoal.status).toBe(200);
    expect(perGoal.body.issues).toEqual([expect.objectContaining({ rule: 'bounds_limit', position: 3, message: 'Booking Office cannot go above L6.' })]);

    const noRefine = buildOrder.filter((e) => e.goal.type !== 'refine').map((e, i) => ({ ...e, position: i + 1 }));
    const level = await harness.api('put', `/strategy-drafts/${draftId}`).send({ buildOrder: noRefine });
    const required = level.body.issues.filter((i: { rule: string }) => i.rule === 'required_goal_type');
    expect(required).toEqual([{ rule: 'required_goal_type', message: 'Every strategy needs a Refine goal with a default above 0.', path: ['buildOrder'] }]);

    const listed = await harness.api('get', '/strategy-drafts');
    expect(listed.body.drafts).toEqual(expect.arrayContaining([expect.objectContaining({ id: draftId, key: DRAFT_KEY, errorCount: 1, ready: false })]));
  });

  it('refuses to export an invalid draft and exports a valid one as a schema-valid Strategy_Definition_File (R6.14)', async () => {
    const refused = await harness.api('get', `/strategy-drafts/${draftId}/export`);
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ code: 'AUTOMATON_STRATEGY_DRAFT_INVALID', error: 'Export is disabled while the draft has errors (1).' });
    expect(refused.body.details.issues).toHaveLength(1);

    await harness.api('put', `/strategy-drafts/${draftId}`).send({ buildOrder: duoV1Definition().buildOrder });
    const exported = await harness.api('get', `/strategy-drafts/${draftId}/export`);
    expect(exported.status).toBe(200);
    // The body is a wrapper, not the file: no attachment header, the admin page saves `definition` (review C10F-1).
    expect(exported.headers['content-disposition']).toBeUndefined();
    expect(exported.body).toMatchObject({ fileName: `${DRAFT_KEY}.v1.json`, upgradeWarning: null });
    const check = validateStrategyDefinition(exported.body.definition, { latestVersions: getStrategyRegistry().latestVersions() });
    expect(check).toMatchObject({ ok: true });
  });

  it('never accepts a draft on PUT /:key/strategy (R6.13)', async () => {
    const created = await harness.api('post', '/').send({
      catalogueKey: PROFILE_KEY, stableName: `Drf Stable ${tag}`.slice(0, 30), franchise: 'F', backstory: 'B', strategyKey: 'paragon',
    });
    expect(created.status).toBe(201);
    const res = await harness.api('put', `/${PROFILE_KEY}/strategy`).send({ strategyKey: DRAFT_KEY });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AUTOMATON_CATALOGUE_INVALID');
    expect((await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: PROFILE_KEY } })).strategyKey).toBe('paragon');
  });

  it('creates a new version from key.vN, keeps its key and refuses a duplicate', async () => {
    const res = await harness.api('post', '/strategy-drafts').send({ basedOn: 'duo.v1' });
    expect(res.status).toBe(201);
    // A new version is numbered latest + 1 whatever it is based on (the repository has duo.v1 and duo.v2).
    expect(res.body).toMatchObject({ basedOn: 'duo.v1', definition: { key: 'duo', version: 3 }, ready: true });
    expect(Array.isArray(res.body.upgradeWarning)).toBe(true);
    const keyChange = await harness.api('put', `/strategy-drafts/${res.body.id}`).send({ key: 'duo-renamed' });
    expect(keyChange.status).toBe(400);
    expect(keyChange.body).toMatchObject({ code: 'AUTOMATON_STRATEGY_DRAFT_INVALID', error: 'A new version keeps the key.' });
    const duplicate = await harness.api('post', '/strategy-drafts').send({ basedOn: 'duo.v1' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('AUTOMATON_STRATEGY_DRAFT_EXISTS');
    expect((await harness.api('post', '/strategy-drafts').send({ basedOn: 'nope.v1' })).body.code).toBe('AUTOMATON_STRATEGY_NOT_FOUND');
    expect((await harness.api('post', '/strategy-drafts').send({ basedOn: 'duo' })).status).toBe(400);
    expect((await harness.api('delete', `/strategy-drafts/${res.body.id}`)).status).toBe(204);
  });

  it('records exactly one audit entry per mutation and per rejection', async () => {
    const auditBefore = await harness.settledAuditCount();
    await harness.api('put', `/strategy-drafts/${draftId}`).send({ displayName: 'Draft renamed' }); // success
    await harness.api('put', `/strategy-drafts/${draftId}`).send({ buildOrder: [{ position: 1, goal: { type: 'teleporter' }, defaultTarget: 1, bounds: { min: 0, max: 1 } }] }); // validation
    await harness.api('put', '/strategy-drafts/999999999').send({ displayName: 'x' }); // not found
    expect((await harness.api('delete', `/strategy-drafts/${draftId}`)).status).toBe(204);
    expect((await harness.api('get', `/strategy-drafts/${draftId}`)).status).toBe(404);
    expect((await harness.api('delete', `/strategy-drafts/${draftId}`)).status).toBe(404);
    const entries = (await harness.auditAtLeast(auditBefore + 5)).slice(auditBefore);
    expect(await harness.settledAuditCount()).toBe(auditBefore + 5);
    expect(entries.map((e) => [e.operationType, e.operationResult])).toEqual([
      ['automaton.strategy_draft_update', 'success'],
      ['automaton.strategy_draft_update', 'failure'],
      ['automaton.strategy_draft_update', 'failure'],
      ['automaton.strategy_draft_delete', 'success'],
      ['automaton.strategy_draft_delete', 'failure'],
    ]);
  });

  it('answers 401 and 403 on the draft endpoints, changing nothing', async () => {
    const before = await prisma.automatonStrategyDraft.count();
    expect((await harness.api('post', '/strategy-drafts', null).send({ key: `${DRAFT_KEY}-x` })).status).toBe(401);
    expect((await harness.api('post', '/strategy-drafts', harness.playerToken).send({ key: `${DRAFT_KEY}-y` })).status).toBe(403);
    expect((await harness.api('get', '/strategy-drafts', harness.playerToken)).status).toBe(403);
    expect(await prisma.automatonStrategyDraft.count()).toBe(before);
  });
});
