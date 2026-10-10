/**
 * Spec #55 task 9.9 — Strategy_Version upgrades through
 * `POST /api/admin/automatons/strategies/:key/upgrade` against the real
 * database (R3.6, R3.7, R6.6, R6.8, R11.3, R11.8, design §14.0a,
 * decision 37).
 *
 * The suite runs on a strategy key of its own (a copy of Duo as v1 and the
 * Duo v2 fixture), injected through the registry seam, so an "all" upgrade
 * touches only this suite's profiles on the shared dev database.
 */
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import { setStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import type { StrategyRegistry } from '../../src/services/automaton/strategies/registry';
import { duoV1Definition, duoV2Definition, registryWith } from '../../src/services/automaton/strategies/__tests__/helpers/upgradeFixtures';
import { createDraftProfile } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();
const KEY_PREFIX = `t55u-${tag}`;
const STRATEGY = `tupg-${tag}`;
const key = (name: string): string => `${KEY_PREFIX}-${name}`;
const NAMES_1_1 = { twoVsTwo: ['Upg Pair One'], threeVsThree: ['Upg Trio One'] };
const NAMES_2_1 = { twoVsTwo: ['Upg Pair One', 'Upg Pair Two'], threeVsThree: ['Upg Trio One'] };
const goal13 = (version: number): string => `${STRATEGY}.v${version}.13.robots`;

const writes = (statements: string[]): string[] => statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));

describe('Strategy_Version upgrade (Spec #55 task 9.9)', () => {
  let harness: AdminApiHarness;
  let previousRegistry: StrategyRegistry | null;
  let previousSender: (message: string) => Promise<unknown>;
  const alerts: string[] = [];

  async function profile(name: string) {
    return prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: key(name) } });
  }

  const upgrade = (body: Record<string, unknown>) => harness.api('post', `/strategies/${STRATEGY}/upgrade`).send(body);

  beforeAll(async () => {
    harness = await startAdminApi(`upg${tag}`);
    previousRegistry = setStrategyRegistry(registryWith([duoV1Definition(STRATEGY), duoV2Definition(STRATEGY)]));
    previousSender = setAlertSender(async (message) => {
      alerts.push(message);
    });
    const stored = { targets: { [goal13(1)]: 2 } };
    await createDraftProfile({ catalogueKey: key('pass'), plannedStableName: `Upg Pass ${tag}`, strategyKey: STRATEGY, slots: [1, 2, 3], teamNames: NAMES_1_1, strategyParameters: stored });
    await createDraftProfile({ catalogueKey: key('few'), plannedStableName: `Upg Few ${tag}`, strategyKey: STRATEGY, slots: [1, 2], teamNames: NAMES_1_1, strategyParameters: stored });
    await createDraftProfile({ catalogueKey: key('onv2'), plannedStableName: `Upg OnTwo ${tag}`, strategyKey: STRATEGY, strategyVersion: 2, slots: [1, 2, 3], teamNames: NAMES_1_1 });
    await createDraftProfile({ catalogueKey: key('other'), plannedStableName: `Upg Other ${tag}`, strategyKey: 'paragon', slots: [1] });
  });

  afterAll(async () => {
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
    setStrategyRegistry(previousRegistry);
    setAlertSender(previousSender);
    await harness.close();
    await prisma.$disconnect();
  });

  it('leaves every profile on its stored version when a newer file is added (R6.6)', async () => {
    const res = await harness.api('get', `/${key('pass')}`);
    expect(res.status).toBe(200);
    expect(res.body.strategy).toMatchObject({ key: STRATEGY, version: 1, latestVersion: 2 });
    expect((await profile('few')).strategyVersion).toBe(1);
    const library = await harness.api('get', '/strategies');
    const entry = library.body.strategies.find((s: { key: string }) => s.key === STRATEGY);
    expect(entry.versions.map((v: { version: number; profileCount: number }) => [v.version, v.profileCount])).toEqual([[1, 2], [2, 1]]);
  });

  it('dry-run shows old → new targets and the R3.6/R3.7 check per profile, and writes nothing', async () => {
    const auditBefore = await harness.settledAuditCount();
    const statements: string[] = [];
    const stop = observePrismaStatements((sql) => statements.push(sql));
    let res;
    try {
      res = await upgrade({ toVersion: 2 });
    } finally {
      stop();
    }
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ strategyKey: STRATEGY, toVersion: 2, confirm: false });
    const byKey = new Map(res.body.profiles.map((p: { catalogueKey: string }) => [p.catalogueKey, p]));
    expect([...byKey.keys()]).toEqual([key('few'), key('pass')]); // on v1 only, Catalogue_Key order
    expect(byKey.get(key('pass'))).toMatchObject({ passes: true, rejection: null, fromVersion: 1, toVersion: 2 });
    expect(byKey.get(key('few'))).toMatchObject({
      passes: false,
      rejection: { code: 'AUTOMATON_BLUEPRINTS_TOO_FEW', reason: 'Goal 13 targets 3 robots, but this stable has 2 blueprints. Add blueprints or lower the target.' },
    });
    const changes = (byKey.get(key('pass')) as { changes: { status: string; label: string; oldTarget: number | null; newTarget: number | null }[] }).changes;
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'clamped', label: 'Robots', oldTarget: 2, newTarget: 3 }),
      expect.objectContaining({ status: 'new', label: 'Roster Expansion', newTarget: 2 }),
      expect.objectContaining({ status: 'removed', label: 'Weapons Workshop', newTarget: null }),
    ]));
    expect(writes(statements)).toEqual([]);
    expect(await harness.settledAuditCount()).toBe(auditBefore);
    expect((await profile('pass')).strategyVersion).toBe(1);
  });

  it('"all" upgrades the passing profiles, leaves the failing one on its version, returns both lists and raises one alert (decision 37)', async () => {
    const auditBefore = await harness.settledAuditCount();
    const fewBefore = await profile('few');
    const otherBefore = await profile('other');
    const onV2Before = await profile('onv2');
    alerts.length = 0;
    const res = await upgrade({ toVersion: 2, confirm: true });
    expect(res.status).toBe(200);
    expect(res.body.upgraded).toEqual([expect.objectContaining({ catalogueKey: key('pass'), fromVersion: 1, toVersion: 2 })]);
    expect(res.body.rejected).toEqual([expect.objectContaining({ catalogueKey: key('few'), code: 'AUTOMATON_BLUEPRINTS_TOO_FEW', fromVersion: 1 })]);

    const passed = await profile('pass');
    expect(passed.strategyVersion).toBe(2);
    expect((passed.strategyParameters as { targets: Record<string, number> }).targets[goal13(2)]).toBe(3);
    expect(await profile('few')).toEqual(fewBefore);
    expect(await profile('other')).toEqual(otherBefore);
    expect(await profile('onv2')).toEqual(onV2Before);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain(key('few'));
    const entries = (await harness.auditAtLeast(auditBefore + 2)).slice(auditBefore);
    expect(entries.map((e) => [e.operationType, e.operationResult, (e.resultSummary as { catalogueKey: string }).catalogueKey])).toEqual(
      expect.arrayContaining([
        ['automaton.upgrade_strategy', 'success', key('pass')],
        ['automaton.upgrade_strategy', 'failure', key('few')],
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it('a single-profile upgrade rejects a Team_Names count change without names and accepts it with teamNames (R3.6)', async () => {
    await createDraftProfile({ catalogueKey: key('teams'), plannedStableName: `Upg Teams ${tag}`, strategyKey: STRATEGY, slots: [1, 2, 3, 4], teamNames: NAMES_1_1 });
    const before = await profile('teams');
    const auditBefore = await harness.settledAuditCount();
    alerts.length = 0;
    const rejected = await upgrade({ toVersion: 2, catalogueKeys: [key('teams')], confirm: true });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      upgraded: [],
      rejected: [{ catalogueKey: key('teams'), code: 'AUTOMATON_TEAM_NAMES_MISMATCH', reason: 'This stable needs 2 team names for 2v2 and 1 for 3v3.' }],
    });
    expect(await profile('teams')).toEqual(before);
    expect(alerts).toHaveLength(1);

    const dry = await upgrade({ toVersion: 2, catalogueKeys: [key('teams')], teamNames: NAMES_2_1 });
    expect(dry.body.profiles[0]).toMatchObject({ passes: true, requiredTeamNames: { twoVsTwo: 2, threeVsThree: 1 } });
    const accepted = await upgrade({ toVersion: 2, catalogueKeys: [key('teams')], confirm: true, teamNames: NAMES_2_1 });
    expect(accepted.body.upgraded).toEqual([expect.objectContaining({ catalogueKey: key('teams'), changedFields: ['strategyVersion', 'strategyParameters', 'teamNames'] })]);
    const after = await profile('teams');
    expect(after.strategyVersion).toBe(2);
    expect(after.teamNames).toEqual(NAMES_2_1);
    expect(await profile('few')).toMatchObject({ strategyVersion: 1 }); // only the selected profile
    const entries = (await harness.auditAtLeast(auditBefore + 2)).slice(auditBefore);
    expect(entries.map((e) => e.operationResult)).toEqual(['failure', 'success']);
  });

  it('rejects a whole request for a profile that is not on an older version, with one audit entry', async () => {
    const auditBefore = await harness.settledAuditCount();
    const res = await upgrade({ toVersion: 2, catalogueKeys: [key('pass')], confirm: true });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('AUTOMATON_UPGRADE_NOT_APPLICABLE');
    const other = await upgrade({ toVersion: 2, catalogueKeys: [key('other')], confirm: true });
    expect(other.body.code).toBe('AUTOMATON_UPGRADE_NOT_APPLICABLE');
    const entries = (await harness.auditAtLeast(auditBefore + 2)).slice(auditBefore);
    expect(entries.map((e) => [e.operationType, e.operationResult])).toEqual([
      ['automaton.upgrade_strategy', 'failure'],
      ['automaton.upgrade_strategy', 'failure'],
    ]);
  });

  it('validates the request: unknown version, teamNames on a multi-stable upgrade, unknown stable', async () => {
    expect((await upgrade({ toVersion: 9 })).body.code).toBe('AUTOMATON_STRATEGY_NOT_FOUND');
    const multi = await upgrade({ toVersion: 2, catalogueKeys: [key('few'), key('teams')], teamNames: NAMES_2_1 });
    expect(multi.status).toBe(400);
    expect((await upgrade({ toVersion: 2, catalogueKeys: [key('missing')] })).status).toBe(404);
    expect((await harness.api('post', `/strategies/${STRATEGY}/upgrade`, harness.playerToken).send({ toVersion: 2, confirm: true })).status).toBe(403);
    expect((await profile('few')).strategyVersion).toBe(1);
  });
});
