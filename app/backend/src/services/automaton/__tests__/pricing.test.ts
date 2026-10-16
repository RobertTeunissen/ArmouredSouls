import {
  attributeIncrementCost,
  discountedWeaponPrice,
  facilityMaxLevel,
  quoteFacilityLevel,
  refinementStepCost,
  robotPurchaseCost,
  weaponResaleValue,
  refinementLabLevelForTier,
} from '../pricing';
import { AUTOMATON_FACILITY_TYPES } from '../stableFacts';
import { FACILITY_TYPES, getFacilityUpgradeCost } from '../../../config/facilities';
import { ROBOT_CREATION_COST } from '../../robot/robotCreationService';
import { validateAndCalculateUpgrades, type AcademyLevels } from '../../robot/robotUpgradeService';
import { calculateRefinementCost } from '../../../shared/utils/weaponRefinement';
import { PRESTIGE_GATES } from '../../../shared/utils/prestigeGates';
import { attributesAt } from './helpers/automatonFixtures';

const MAX_ACADEMIES: AcademyLevels = {
  combat_training_academy: 10,
  defense_training_academy: 10,
  mobility_training_academy: 10,
  ai_training_academy: 10,
};

describe('pricing (R5.3): identical to the charging services', () => {
  it('knows the facility types in FACILITY_TYPES order', () => {
    expect([...AUTOMATON_FACILITY_TYPES]).toEqual(FACILITY_TYPES.map((f) => f.type));
  });

  it.each(AUTOMATON_FACILITY_TYPES)('quotes every level of %s at the upgrade price and gate', (type) => {
    const maxLevel = facilityMaxLevel(type);
    for (let level = 0; level < maxLevel; level++) {
      const open = quoteFacilityLevel(type, level, 1_000_000);
      expect(open).toEqual({
        kind: 'available',
        facilityType: type,
        toLevel: level + 1,
        cost: getFacilityUpgradeCost(type, level),
        prestigeRequired: PRESTIGE_GATES[level],
      });
    }
    expect(quoteFacilityLevel(type, maxLevel, 1_000_000)).toEqual({
      kind: 'max_level', facilityType: type, currentLevel: maxLevel, maxLevel,
    });
  });

  it('applies the Prestige_Gate as prestige ≥ requirement', () => {
    expect(quoteFacilityLevel('roster_expansion', 3, 999)).toEqual({
      kind: 'prestige_gate',
      facilityType: 'roster_expansion',
      toLevel: 4,
      cost: getFacilityUpgradeCost('roster_expansion', 3),
      prestigeRequired: 1000,
      prestigeHeld: 999,
    });
    expect(quoteFacilityLevel('roster_expansion', 3, 1000).kind).toBe('available');
    expect(quoteFacilityLevel('weapons_workshop', 2, 0).kind).toBe('available');
  });

  it('prices a robot at ROBOT_CREATION_COST', () => {
    expect(robotPurchaseCost()).toBe(ROBOT_CREATION_COST);
    expect(robotPurchaseCost()).toBe(500_000);
  });

  it.each([
    // Season 2: 5% per Workshop level, 50% at L10.
    [400_000, 0, 400_000], [400_000, 3, 340_000], [57_333, 7, 37_266], [400_000, 10, 200_000],
  ])('discounts a ₡%i weapon at Workshop L%i to ₡%i', (cost, level, expected) => {
    expect(discountedWeaponPrice(cost, level)).toBe(expected);
  });

  it.each([
    [280_000, 0, 0], [280_000, 3, 84_000], [99_999, 1, 9_999], [400_000, 10, 400_000],
  ])('resells pricePaid ₡%i at Workshop L%i for ₡%i', (pricePaid, level, expected) => {
    expect(weaponResaleValue(pricePaid, level)).toBe(expected);
  });

  it('prices attribute increments exactly like validateAndCalculateUpgrades', () => {
    for (const trainingLevel of [0, 1, 5, 9, 10]) {
      for (const rosterCapacity of [1, 3, 7, 11]) {
        for (const [from, to] of [[1, 2], [1, 10], [7, 15], [24, 50]]) {
          const { totalCost } = validateAndCalculateUpgrades(
            { combatPower: { currentLevel: from, plannedLevel: to } },
            attributesAt(from),
            trainingLevel,
            MAX_ACADEMIES,
            rosterCapacity,
          );
          expect(attributeIncrementCost(from, to, trainingLevel, rosterCapacity)).toBe(totalCost);
        }
      }
    }
  });

  it('floors a fractional current level like the upgrade service', () => {
    expect(attributeIncrementCost(4.75, 6, 0, 1)).toBe(attributeIncrementCost(4, 6, 0, 1));
  });

  it('prices refinements with calculateRefinementCost', () => {
    expect(refinementStepCost('sharpen', 1, 0)).toBe(300_000);
    expect(refinementStepCost('sharpen', 1, 1)).toBe(900_000);
    expect(refinementStepCost('forge', 1, 0)).toBe(400_000);
    expect(refinementStepCost('forge', 1, 1)).toBe(1_200_000);
    expect(refinementStepCost('hone', 3, 0)).toBe(calculateRefinementCost('hone', 3, 0));
    expect(refinementStepCost('augment', 2, 1)).toBe(80_000);
  });

  it('names the Refinement Lab level each tier needs', () => {
    expect(refinementLabLevelForTier('hone')).toBe(1);
    expect(refinementLabLevelForTier('augment')).toBe(3);
    expect(refinementLabLevelForTier('sharpen')).toBe(5);
    expect(refinementLabLevelForTier('forge')).toBe(8);
  });
});
