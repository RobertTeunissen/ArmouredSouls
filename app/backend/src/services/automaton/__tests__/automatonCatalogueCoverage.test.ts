/**
 * Coverage_Matrix (Spec #55, R10.9, `review/CATALOGUE.md` §14, design §15.5,
 * task 8.6): the union of the repository Catalogue_Entries exercises every
 * engine capability. A row fails when an edit empties its cell.
 */
import { getSubscriptionCap } from '../../../config/subscriptions';
import { calculateStorageCapacity } from '../../../utils/storageCalculations';
import { loadCatalogueDirectory, type CatalogueBlueprint, type LoadedCatalogueEntry } from '../automatonCatalogueService';
import { quoteFacilityLevel, workshopLevelForTier } from '../pricing';
import { teamsForSlots } from '../teamRule';
import { allocateEvents } from '../upkeep/subscriptionUpkeep';
import { SUBSCRIBABLE_EVENT_TYPES } from '../../subscription/eventRegistry';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import type { UpgradeStrategy } from '../strategies/strategyTypes';
import { repositoryStrategies, seedCatalogueContext } from './helpers/catalogueTestSupport';

const loaded: LoadedCatalogueEntry[] = loadCatalogueDirectory(seedCatalogueContext()).entries;
const blueprints: CatalogueBlueprint[] = loaded.flatMap(({ entry }) => entry.blueprints);

function strategyOf(item: LoadedCatalogueEntry): UpgradeStrategy {
  const strategy = repositoryStrategies().getStrategy(item.entry.strategy.key, item.entry.strategy.version);
  if (!strategy) throw new Error(`missing strategy for ${item.entry.catalogueKey}`);
  return strategy;
}

/** Robots Goal_Targets of a stable (defaults merged with overrides), in Build_Order order. */
function robotTargets(item: LoadedCatalogueEntry): number[] {
  return strategyOf(item).buildOrder.filter((d) => d.type === 'robots').map((d) => item.parameters.targets[d.id]);
}

const openingRobots = (item: LoadedCatalogueEntry): number => robotTargets(item)[0];
const maxRobots = (item: LoadedCatalogueEntry): number => Math.min(Math.max(...robotTargets(item)), item.entry.blueprints.length);
const finalStage = (b: CatalogueBlueprint) => b.weaponPath[b.weaponPath.length - 1];
const weaponsOf = (stage: { main: string; offhand?: string }): string[] => (stage.offhand ? [stage.main, stage.offhand] : [stage.main]);

describe('Coverage_Matrix (R10.9, review/CATALOGUE.md §14)', () => {
  it('covers all 6 strategies', () => {
    expect(new Set(loaded.map(({ entry }) => entry.strategy.key))).toEqual(new Set(['swarm', 'paragon', 'duo', 'trio', 'tycoon', 'generalist']));
  });

  it('covers all 6 Build_Focus presets, 4 loadouts and 3 stances', () => {
    expect(new Set(blueprints.map((b) => b.buildFocus)).size).toBe(6);
    expect(new Set(blueprints.map((b) => b.loadoutType))).toEqual(new Set(['single', 'weapon_shield', 'dual_wield', 'two_handed']));
    expect(new Set(blueprints.map((b) => b.stance))).toEqual(new Set(['offensive', 'defensive', 'balanced']));
  });

  it('covers 4 range bands from the stage-0 weapons', () => {
    expect(new Set(blueprints.map((b) => SEED_WEAPON_MAP.get(b.weaponPath[0].main)?.rangeBand))).toEqual(new Set(['melee', 'short', 'mid', 'long']));
  });

  it('has a dual_wield stage with two different weapons', () => {
    expect(blueprints.some((b) => b.loadoutType === 'dual_wield' && b.weaponPath.some((s) => s.offhand !== undefined && s.offhand !== s.main))).toBe(true);
  });

  it('lists all 9 event types in every Event_Order', () => {
    for (const { entry } of loaded) expect([...entry.eventOrder].sort()).toEqual([...SUBSCRIBABLE_EVENT_TYPES].sort());
  });

  it('skips a team event because a member has no free slot (opening robot count, Booking Office L1–L6)', () => {
    const skipped = loaded.some((item) => {
      const slots = item.entry.blueprints.map((b) => b.slot).slice(0, openingRobots(item));
      const robots = slots.map((slot) => ({ robotId: slot, slotIndex: slot, heldEventTypes: [] }));
      const teams = teamsForSlots(slots).map((team) => ({ size: team.size, memberRobotIds: team.slots }));
      return [1, 2, 3, 4, 5, 6].some((level) => {
        const desired = allocateEvents({ robots, teams, bookingCap: getSubscriptionCap(level), eventOrder: item.entry.eventOrder });
        return teams.some((team) => item.entry.eventOrder.some((event) => {
          const size = event.endsWith('_3v3') ? 3 : event.endsWith('_2v2') || event === 'tag_team' ? 2 : 0;
          return size === team.size && team.memberRobotIds.some((id) => !desired.get(id)?.includes(event));
        }));
      });
    });
    expect(skipped).toBe(true);
  });

  it('has robots in no 3v3 team and a robot in both a 2v2 and a 3v3 team', () => {
    const notIn3v3 = loaded.some((item) => {
      const slots = item.entry.blueprints.map((b) => b.slot).slice(0, maxRobots(item));
      const inThree = new Set(teamsForSlots(slots).filter((t) => t.size === 3).flatMap((t) => t.slots));
      return slots.some((slot) => !inThree.has(slot));
    });
    const inBoth = loaded.some((item) => {
      const teams = teamsForSlots(item.entry.blueprints.map((b) => b.slot).slice(0, maxRobots(item)));
      const two = new Set(teams.filter((t) => t.size === 2).flatMap((t) => t.slots));
      return teams.filter((t) => t.size === 3).flatMap((t) => t.slots).some((slot) => two.has(slot));
    });
    expect(notIn3v3).toBe(true);
    expect(inBoth).toBe(true);
  });

  it('has a Weapon_Path with at least 2 stages', () => {
    expect(blueprints.some((b) => b.weaponPath.length >= 2)).toBe(true);
  });

  it('has a replaced weapon that storage pressure forces to be sold (no later blueprint reuses it)', () => {
    const covered = loaded.some(({ entry }) => {
      const carried = entry.blueprints.flatMap((b) => weaponsOf(finalStage(b))).length;
      if (carried <= calculateStorageCapacity(0)) return false;
      return entry.blueprints.some((b, i) => weaponsOf(b.weaponPath[0]).some((name) =>
        !weaponsOf(finalStage(b)).includes(name)
        && !entry.blueprints.slice(i + 1).some((later) => later.weaponPath.some((stage) => weaponsOf(stage).includes(name)))));
    });
    expect(covered).toBe(true);
  });

  it('has a replaced weapon reused by a robot that joins later', () => {
    const covered = loaded.some(({ entry }) => entry.blueprints.some((later, i) => {
      const replaced = entry.blueprints.slice(0, i).flatMap((earlier) => earlier.weaponPath.slice(0, -1).flatMap(weaponsOf));
      return weaponsOf(later.weaponPath[0]).every((name) => replaced.includes(name));
    }));
    expect(covered).toBe(true);
  });

  it('has a Refinement_Plan on every blueprint and each refinement tier', () => {
    expect(blueprints.every((b) => b.refinementPlan.length > 0)).toBe(true);
    expect(new Set(blueprints.flatMap((b) => b.refinementPlan.map((s) => s.tier)))).toEqual(new Set(['hone', 'augment', 'sharpen', 'forge']));
  });

  it('has a Hone on a negative catalogue bonus', () => {
    expect(blueprints.some((b) => b.refinementPlan.some((step) => {
      if (step.tier !== 'hone' || step.targetAttribute === undefined) return false;
      const name = step.hand === 'main' ? finalStage(b).main : finalStage(b).offhand;
      return (SEED_WEAPON_MAP.get(name ?? '')?.bonuses[step.targetAttribute] ?? 0) < 0;
    }))).toBe(true);
  });

  it('has offhand refinement on a shield and on a dual-wield weapon', () => {
    const offhandSteps = (loadout: CatalogueBlueprint['loadoutType']) => blueprints.some((b) => b.loadoutType === loadout && b.refinementPlan.some((s) => s.hand === 'offhand'));
    expect(offhandSteps('weapon_shield')).toBe(true);
    expect(offhandSteps('dual_wield')).toBe(true);
  });

  it('has a refine Goal_Target shorter than a plan', () => {
    expect(loaded.some((item) => {
      const refine = strategyOf(item).buildOrder.find((d) => d.type === 'refine');
      const target = refine ? item.parameters.targets[refine.id] : 0;
      return item.entry.blueprints.some((b) => b.refinementPlan.length > target);
    })).toBe(true);
  });

  it('has a plan step blocked by the Weapons Workshop level (Prestige_Gate at 0 prestige)', () => {
    const gated = (tier: CatalogueBlueprint['refinementPlan'][number]['tier']): boolean => {
      for (let level = 0; level < workshopLevelForTier(tier); level++) {
        if (quoteFacilityLevel('weapons_workshop', level, 0).kind === 'prestige_gate') return true;
      }
      return false;
    };
    expect(blueprints.some((b) => b.refinementPlan.some((s) => gated(s.tier)))).toBe(true);
  });

  it('has a one-robot stable, a stable with a robots Goal_Target ≥ 7 and a stable with a Goal_Target override', () => {
    expect(loaded.some((item) => Math.max(...robotTargets(item)) === 1)).toBe(true);
    expect(loaded.some((item) => Math.max(...robotTargets(item)) >= 7)).toBe(true);
    expect(loaded.some(({ entry }) => Object.keys(entry.strategy.targetOverrides).length > 0)).toBe(true);
  });

  it('has a blueprint slot beyond the default robots target', () => {
    expect(loaded.some((item) => item.entry.blueprints.length > Math.max(...robotTargets(item)))).toBe(true);
  });

  it('has the yield extremes 0 and 30', () => {
    const yields = new Set(blueprints.map((b) => b.yieldThreshold));
    expect(yields.has(0)).toBe(true);
    expect(yields.has(30)).toBe(true);
  });

  it('buys Tuning Bay levels in every stable: every catalogue strategy has a Tuning Bay Goal (decision 29)', () => {
    for (const item of loaded) {
      const tuningGoals = strategyOf(item).buildOrder.filter((d) => d.type === 'facility' && d.facilityType === 'tuning_bay');
      expect(tuningGoals.length).toBeGreaterThan(0);
      expect(Math.max(...tuningGoals.map((d) => item.parameters.targets[d.id]))).toBeGreaterThan(0);
    }
  });
});
