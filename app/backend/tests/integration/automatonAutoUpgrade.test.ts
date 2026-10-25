/**
 * Automatic Strategy_Version upgrades (`strategies/autoUpgrade.ts`), the
 * `pnpm run automaton:upgrade` step of the ACC deploy.
 *
 * Real database; limited to this suite's profiles with the Catalogue_Key
 * filter. The registry is the repository's with a synthetic `tauto-*` key in
 * versions 1 and 2 (Duo v1 and the upgrade fixture's v2, which needs a third
 * robot), so a two-blueprint stable is rejected and stays on v1.
 */
import prisma from '../../src/lib/prisma';
import { formatAutoUpgradeSummary, upgradeProfilesToLatest } from '../../src/services/automaton/strategies/autoUpgrade';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import type { StrategyParametersV1 } from '../../src/types/automaton';
import { duoV1Definition, duoV2Definition, registryWith } from '../../src/services/automaton/strategies/__tests__/helpers/upgradeFixtures';
import { createDraftProfile } from '../helpers/automatonStable';

const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const KEY = `tauto-${tag}`;
const PREFIX = `tau-${tag}`;
const registry = registryWith([{ ...duoV1Definition(KEY) }, duoV2Definition(KEY)]);
const ownOnly = (catalogueKey: string): boolean => catalogueKey.startsWith(PREFIX);
const NAMES = { twoVsTwo: ['Auto Pair'], threeVsThree: ['Auto Trio'] };

async function profile(catalogueKey: string) {
  return prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, select: { strategyVersion: true, strategyParameters: true } });
}

describe('automatic Strategy_Version upgrades', () => {
  const alerts: string[] = [];
  let previousSender: ReturnType<typeof setAlertSender>;

  beforeAll(async () => {
    previousSender = setAlertSender(async (message) => { alerts.push(message); });
    await createDraftProfile({ catalogueKey: `${PREFIX}-pass`, plannedStableName: `Auto Pass ${tag}`.slice(0, 30), strategyKey: KEY, slots: [1, 2, 3], teamNames: NAMES });
    await createDraftProfile({ catalogueKey: `${PREFIX}-few`, plannedStableName: `Auto Few ${tag}`.slice(0, 30), strategyKey: KEY, slots: [1, 2], teamNames: NAMES });
    await createDraftProfile({ catalogueKey: `${PREFIX}-new`, plannedStableName: `Auto New ${tag}`.slice(0, 30), strategyKey: KEY, strategyVersion: 2, slots: [1, 2, 3], teamNames: NAMES });
  });

  afterAll(async () => {
    setAlertSender(previousSender);
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('reports what a dry run would do and writes nothing', async () => {
    const result = await upgradeProfilesToLatest({ registry, dryRun: true, catalogueKeyFilter: ownOnly });
    expect(result.strategies).toEqual([expect.objectContaining({
      strategyKey: KEY, toVersion: 2, wouldUpgrade: [`${PREFIX}-pass`], upgraded: [],
      rejected: [expect.objectContaining({ catalogueKey: `${PREFIX}-few`, code: 'AUTOMATON_BLUEPRINTS_TOO_FEW' })],
    })]);
    expect((await profile(`${PREFIX}-pass`)).strategyVersion).toBe(1);
    expect(alerts).toEqual([]);
  });

  it('upgrades every outdated profile, keeps a rejected one on its version and alerts it', async () => {
    const result = await upgradeProfilesToLatest({ registry, catalogueKeyFilter: ownOnly });
    expect(result).toMatchObject({ dryRun: false, upgradedCount: 1, rejectedCount: 1 });
    const pass = await profile(`${PREFIX}-pass`);
    expect(pass.strategyVersion).toBe(2);
    // The fixture's v2 Goal 13 (robots 3–4): the stored v1 default 2 is clamped to 3.
    expect((pass.strategyParameters as unknown as StrategyParametersV1).targets[`${KEY}.v2.13.robots`]).toBe(3);
    expect((await profile(`${PREFIX}-few`)).strategyVersion).toBe(1);
    expect((await profile(`${PREFIX}-new`)).strategyVersion).toBe(2);
    expect(alerts.filter((a) => a.includes('upgrade rejected') && a.includes(`${PREFIX}-few`))).toHaveLength(1);
    expect(formatAutoUpgradeSummary(result)[0]).toBe(`Automaton upgrade: ${KEY} → v2: 1 upgraded, 1 rejected`);
  });

  it('is idempotent: a second run only retries the rejected profile', async () => {
    const result = await upgradeProfilesToLatest({ registry, catalogueKeyFilter: ownOnly });
    expect(result).toMatchObject({ upgradedCount: 0, rejectedCount: 1 });
    expect(result.strategies.map((s) => s.rejected.map((r) => r.catalogueKey))).toEqual([[`${PREFIX}-few`]]);
  });

  it('reports nothing to do when every profile is current', async () => {
    const result = await upgradeProfilesToLatest({ registry, catalogueKeyFilter: (key) => key === `${PREFIX}-new` });
    expect(result.strategies).toEqual([]);
    expect(formatAutoUpgradeSummary(result)).toEqual(['Automaton upgrade: every profile is on the latest version of its strategy.']);
  });
});
