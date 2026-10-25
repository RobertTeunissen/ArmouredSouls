/**
 * The v2 Strategy_Definition_Files (Automaton economy change, October 2026):
 * every strategy gains an Economy Goal and moves Repair Bay, Merchandising
 * Hub and Streaming Studio ahead of the larger attribute milestones (Swarm:
 * ahead of the fourth robot), without changing which Goals exist, so a v1
 * stable's targets migrate unchanged.
 *
 * The conformance suite and the scenario test already cover every file; this
 * suite pins what v2 is for.
 */
import type { BlueprintFacts, FacilityType } from '../../stableFacts';
import { migrateTargets } from '../migrateTargets';
import { getStrategyRegistry } from '../defaultRegistry';
import { defaultParameters } from '../strategyParameters';
import type { UpgradeStrategy } from '../strategyTypes';
import {
  CLONE_LEGION_OPENING,
  DECEPTICON_ARMADA_OPENING,
  JAEGER_CORPS_OPENING,
  PLANET_EXPRESS_OPENING,
  ROBOCOP_PRECINCT_OPENING,
  AUTOBOTS_ARK_OPENING,
} from './helpers/openingBlueprints';
import { projectApprovedOpening } from './helpers/strategyFixtureSupport';

const registry = getStrategyRegistry();
const ECONOMY_FACILITIES: readonly FacilityType[] = ['repair_bay', 'merchandising_hub', 'streaming_studio'];

const OPENINGS: Record<string, BlueprintFacts[]> = {
  duo: JAEGER_CORPS_OPENING,
  generalist: AUTOBOTS_ARK_OPENING,
  paragon: ROBOCOP_PRECINCT_OPENING,
  swarm: CLONE_LEGION_OPENING,
  trio: DECEPTICON_ARMADA_OPENING,
  tycoon: PLANET_EXPRESS_OPENING,
};

function strategy(key: string, version: number): UpgradeStrategy {
  const found = registry.getStrategy(key, version);
  if (!found) throw new Error(`${key}.v${version} is missing`);
  return found;
}

/** Position of the first Goal matching `predicate`, or Infinity. */
function firstPosition(s: UpgradeStrategy, predicate: (spec: UpgradeStrategy['buildOrder'][number]) => boolean): number {
  return s.buildOrder.find(predicate)?.position ?? Number.POSITIVE_INFINITY;
}

describe.each(Object.keys(OPENINGS))('%s.v2', (key) => {
  const v1 = strategy(key, 1);
  const v2 = strategy(key, 2);

  it('has an Economy Goal (default 20 cycles) before the second attribute milestone', () => {
    const economy = v2.buildOrder.filter((spec) => spec.type === 'economy');
    expect(economy).toHaveLength(1);
    expect(economy[0]).toMatchObject({ defaultTarget: 20, bounds: { min: 0, max: 50 } });
    const attributeGoals = v2.buildOrder.filter((spec) => spec.type === 'attributes');
    expect(economy[0].position).toBeLessThan(attributeGoals[1].position);
  });

  it('puts Repair Bay, Merchandising Hub and Streaming Studio before the second attribute milestone', () => {
    const secondAttributes = v2.buildOrder.filter((spec) => spec.type === 'attributes')[1].position;
    for (const facilityType of ECONOMY_FACILITIES) {
      expect(firstPosition(v2, (spec) => spec.type === 'facility' && spec.facilityType === facilityType)).toBeLessThan(secondAttributes);
    }
  });

  it('keeps every v1 Goal, so stored targets migrate unchanged', () => {
    const migration = migrateTargets(v1.buildOrder, v2.buildOrder, defaultParameters(v1.buildOrder));
    expect(migration.changes.filter((c) => c.status === 'removed' || c.status === 'clamped')).toEqual([]);
    expect(migration.changes.filter((c) => c.status === 'new').map((c) => c.type)).toEqual(['economy']);
  });

  it('reaches at least the v1 levels of the economy facilities in the opening build, without going negative', () => {
    const before = projectApprovedOpening(v1, OPENINGS[key]);
    const after = projectApprovedOpening(v2, OPENINGS[key]);
    expect(after.projection.facts.balance).toBeGreaterThanOrEqual(0);
    expect(after.robotsBought.length).toBeGreaterThanOrEqual(1);
    for (const facilityType of ECONOMY_FACILITIES) {
      expect(after.facilityLevels[facilityType] ?? 0).toBeGreaterThanOrEqual(before.facilityLevels[facilityType] ?? 0);
    }
    expect(after.facilityLevels.repair_bay ?? 0).toBeGreaterThanOrEqual(1);
  });
});

it('Swarm v2 buys its income and repair facilities before the fourth robot', () => {
  const swarm = strategy('swarm', 2);
  const fourthRobot = firstPosition(swarm, (spec) => spec.type === 'robots' && spec.defaultTarget === 4);
  for (const facilityType of ECONOMY_FACILITIES) {
    expect(firstPosition(swarm, (spec) => spec.type === 'facility' && spec.facilityType === facilityType)).toBeLessThan(fourthRobot);
  }
});
