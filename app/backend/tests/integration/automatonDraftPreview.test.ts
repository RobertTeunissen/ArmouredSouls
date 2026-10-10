/**
 * Spec #55 task 9.10 — Strategy_Draft preview and the upgrade warning
 * against the real database (R6.12, R6.14, design §14.0b, decision 37).
 *
 * - `POST /strategy-drafts/:id/preview`: per-Goal statuses on a chosen
 *   profile through the Turn_Preview path and the fresh-stable opening build,
 *   with zero database writes (write-counting) and no file writes.
 * - The upgrade warning of a new-version draft on validation and export: the
 *   profiles the upgrade would reject with their reason; export still works;
 *   a new-strategy draft has none; the check writes nothing.
 */
import fs from 'fs';
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import { STRATEGY_DIRECTORY } from '../../src/services/automaton/strategies/registry';
import { getAutomatonUploadDir } from '../../src/services/automaton/automatonImageService';
import { duoV1Definition, duoV2Definition } from '../../src/services/automaton/strategies/__tests__/helpers/upgradeFixtures';
import { createDraftProfile } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();
const KEY_PREFIX = `t55v-${tag}`;
const key = (name: string): string => `${KEY_PREFIX}-${name}`;
const NAMES_1_1 = { twoVsTwo: ['Prv Pair One'], threeVsThree: ['Prv Trio One'] };

const writes = (statements: string[]): string[] => statements.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));

function listing(directory: string): string[] {
  return fs.existsSync(directory) ? (fs.readdirSync(directory, { recursive: true }) as string[]).sort() : [];
}

describe('Strategy_Draft preview and upgrade warning (Spec #55 task 9.10)', () => {
  let harness: AdminApiHarness;
  let newStrategyDraft: number;
  let newVersionDraft: number;

  async function observed<T>(run: () => Promise<T>): Promise<{ value: T; statements: string[] }> {
    const statements: string[] = [];
    const stop = observePrismaStatements((sql) => statements.push(sql));
    try {
      return { value: await run(), statements };
    } finally {
      stop();
    }
  }

  beforeAll(async () => {
    harness = await startAdminApi(`prv${tag}`);
    // Duo profiles: 3 blueprints pass the v2 fixture, 2 fail R3.7, 4 with one 2v2 name fail the Team_Names count.
    await createDraftProfile({ catalogueKey: key('pass'), plannedStableName: `Prv Pass ${tag}`, strategyKey: 'duo', slots: [1, 2, 3], teamNames: NAMES_1_1 });
    await createDraftProfile({ catalogueKey: key('few'), plannedStableName: `Prv Few ${tag}`, strategyKey: 'duo', slots: [1, 2], teamNames: NAMES_1_1 });
    await createDraftProfile({ catalogueKey: key('teams'), plannedStableName: `Prv Teams ${tag}`, strategyKey: 'duo', slots: [1, 2, 3, 4], teamNames: NAMES_1_1 });

    const blank = await harness.api('post', '/strategy-drafts').send({ key: `tprv-${tag}`, displayName: 'Preview test', description: 'A preview test strategy.' });
    newStrategyDraft = blank.body.id;
    await harness.api('put', `/strategy-drafts/${newStrategyDraft}`).send({ buildOrder: duoV1Definition().buildOrder });
    const version = await harness.api('post', '/strategy-drafts').send({ basedOn: 'duo.v1' });
    expect(version.status).toBe(201);
    newVersionDraft = version.body.id;
  });

  afterAll(async () => {
    await prisma.automatonStrategyDraft.deleteMany({ where: { createdBy: harness.adminId } });
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
    await harness.close();
    await prisma.$disconnect();
  });

  it('previews a draft on a profile and on a fresh ₡3,000,000 stable with zero database and file writes (R6.12)', async () => {
    const uploadsBefore = listing(getAutomatonUploadDir());
    const strategiesBefore = listing(STRATEGY_DIRECTORY);
    const { value: res, statements } = await observed(() =>
      harness.api('post', `/strategy-drafts/${newStrategyDraft}/preview`).send({ catalogueKey: key('pass') }));
    expect(res.status).toBe(200);
    expect(writes(statements)).toEqual([]);
    expect(listing(getAutomatonUploadDir())).toEqual(uploadsBefore);
    expect(listing(STRATEGY_DIRECTORY)).toEqual(strategiesBefore);

    expect(res.body).toMatchObject({ draftId: newStrategyDraft, catalogueKey: key('pass') });
    const goals = res.body.profile.goals as { position: number; status: string }[];
    expect(goals.map((g) => g.position)).toEqual(duoV1Definition().buildOrder.map((e) => e.position));
    expect(goals.every((g) => ['done', 'bought', 'saving', 'blocked', 'waiting'].includes(g.status))).toBe(true);
    expect(res.body.profile.startBalance).toBe(3_000_000); // a draft profile previews as a fresh stable
    const purchases = res.body.freshStable.purchases as { kind: string; cost: number }[];
    expect(res.body.freshStable.startBalance).toBe(3_000_000);
    expect(purchases.length).toBeGreaterThan(0);
    expect(purchases.some((p) => p.kind === 'robot_creation')).toBe(true);
    expect(res.body.freshStable.endBalance).toBeGreaterThanOrEqual(0);
  });

  it('refuses to preview an invalid draft or an unknown stable', async () => {
    await harness.api('put', `/strategy-drafts/${newVersionDraft}`).send({ buildOrder: [] });
    const invalid = await harness.api('post', `/strategy-drafts/${newVersionDraft}/preview`).send({ catalogueKey: key('pass') });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('AUTOMATON_STRATEGY_DRAFT_INVALID');
    const unknown = await harness.api('post', `/strategy-drafts/${newStrategyDraft}/preview`).send({ catalogueKey: key('missing') });
    expect(unknown.status).toBe(404);
    expect((await harness.api('post', `/strategy-drafts/${newStrategyDraft}/preview`, harness.playerToken).send({ catalogueKey: key('pass') })).status).toBe(403);
  });

  it('lists exactly the profiles a new version would reject, with their reason, and writes nothing (R6.14)', async () => {
    const update = await harness.api('put', `/strategy-drafts/${newVersionDraft}`).send({ buildOrder: duoV2Definition().buildOrder });
    expect(update.status).toBe(200);
    expect(update.body.ready).toBe(true);
    const mine = (warning: { catalogueKey: string }[]) => warning.filter((w) => w.catalogueKey.startsWith(KEY_PREFIX));
    expect(mine(update.body.upgradeWarning)).toEqual([
      { catalogueKey: key('few'), stableName: `Prv Few ${tag}`, fromVersion: 1, code: 'AUTOMATON_BLUEPRINTS_TOO_FEW', reason: 'Goal 13 targets 3 robots, but this stable has 2 blueprints. Add blueprints or lower the target.' },
      { catalogueKey: key('teams'), stableName: `Prv Teams ${tag}`, fromVersion: 1, code: 'AUTOMATON_TEAM_NAMES_MISMATCH', reason: 'This stable needs 2 team names for 2v2 and 1 for 3v3.' },
    ]);

    const { value: read, statements } = await observed(() => harness.api('get', `/strategy-drafts/${newVersionDraft}`));
    expect(mine(read.body.upgradeWarning)).toHaveLength(2);
    expect(writes(statements)).toEqual([]);
  });

  it('still exports a new version with the warning; a new strategy has no warning', async () => {
    const exported = await harness.api('get', `/strategy-drafts/${newVersionDraft}/export`);
    expect(exported.status).toBe(200);
    expect(exported.body.fileName).toBe('duo.v2.json');
    expect(exported.body.upgradeWarning.filter((w: { catalogueKey: string }) => w.catalogueKey.startsWith(KEY_PREFIX)).map((w: { catalogueKey: string }) => w.catalogueKey))
      .toEqual([key('few'), key('teams')]);
    const fresh = await harness.api('get', `/strategy-drafts/${newStrategyDraft}/export`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.upgradeWarning).toBeNull();
    expect((await harness.api('get', `/strategy-drafts/${newStrategyDraft}`)).body.upgradeWarning).toBeNull();
    // Nothing was upgraded by the check.
    expect((await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey: key('few') } })).strategyVersion).toBe(1);
  });
});
