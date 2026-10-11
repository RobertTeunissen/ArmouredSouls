/**
 * Test fixtures for the pure Automaton engine (Spec #55). Not a test file.
 *
 * The weight table here is a test-only table, so the Build_Focus maths
 * tests do not move when the approved presets (`BUILD_FOCUS_WEIGHTS`) change.
 */
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../../../shared/utils/robotAttributes';
import type { BuildFocusWeightTable } from '../../buildFocus';
import {
  AUTOMATON_FACILITY_TYPES,
  type BlueprintFacts,
  type FacilityType,
  type InventoryFacts,
  type RobotFacts,
  type StableFacts,
  type TeamFacts,
  type WeaponFacts,
} from '../../stableFacts';
import type { GoalContext } from '../../goals/goalTypes';
import type { RefinementRow } from '../../../../shared/utils/weaponRefinement';

export const TEST_WEIGHTS: BuildFocusWeightTable = {
  bruiser: { combat: 1, defense: 0.8, mobility: 0.7, ai: 0.4 },
  deadeye: { combat: 1, defense: 0.4, mobility: 0.5, ai: 0.8 },
  warden: { combat: 0.6, defense: 1, mobility: 0.6, ai: 0.5 },
  sprinter: { combat: 0.7, defense: 0.5, mobility: 1, ai: 0.5 },
  tactician: { combat: 0.6, defense: 0.6, mobility: 0.5, ai: 1 },
  versatile: { combat: 1, defense: 1, mobility: 1, ai: 1 },
};

export function attributesAt(level: number, overrides: Partial<Record<RobotAttribute, number>> = {}): Record<RobotAttribute, number> {
  const attributes = {} as Record<RobotAttribute, number>;
  for (const attribute of ROBOT_ATTRIBUTES) attributes[attribute] = overrides[attribute] ?? level;
  return attributes;
}

export function facilities(overrides: Partial<Record<FacilityType, number>> = {}): Record<FacilityType, number> {
  const levels = {} as Record<FacilityType, number>;
  for (const type of AUTOMATON_FACILITY_TYPES) levels[type] = overrides[type] ?? 0;
  return levels;
}

export const WEAPONS: WeaponFacts[] = [
  { weaponId: 1, name: 'Practice Blade', cost: 50_000, weaponType: 'melee', handsRequired: 'one', rangeBand: 'melee', bonuses: { combatPower: 2 } },
  { weaponId: 2, name: 'Laser Pistol', cost: 60_000, weaponType: 'energy', handsRequired: 'one', rangeBand: 'short', bonuses: { targetingSystems: 3 } },
  { weaponId: 3, name: 'Volt Sabre', cost: 400_000, weaponType: 'energy', handsRequired: 'one', rangeBand: 'melee', bonuses: { combatPower: 8, attackSpeed: 4 } },
  { weaponId: 4, name: 'Plasma Cutter', cost: 380_000, weaponType: 'energy', handsRequired: 'one', rangeBand: 'melee', bonuses: { penetration: 6 } },
  { weaponId: 5, name: 'Aegis Bulwark', cost: 300_000, weaponType: 'shield', handsRequired: 'shield', rangeBand: 'melee', bonuses: { armorPlating: 12, evasionThrusters: -5, servoMotors: -4 } },
  { weaponId: 6, name: 'Railgun', cost: 500_000, weaponType: 'ballistic', handsRequired: 'two', rangeBand: 'long', bonuses: { penetration: 9 } },
  { weaponId: 7, name: 'Training Rifle', cost: 70_000, weaponType: 'ballistic', handsRequired: 'two', rangeBand: 'long', bonuses: {} },
];

export function weaponMap(list: readonly WeaponFacts[] = WEAPONS): ReadonlyMap<string, WeaponFacts> {
  return new Map(list.map((w) => [w.name, w]));
}

export function blueprint(slotIndex: number, overrides: Partial<BlueprintFacts> = {}): BlueprintFacts {
  return {
    blueprintId: 100 + slotIndex,
    slotIndex,
    robotName: `Unit ${slotIndex}`,
    imageUrl: null,
    loadoutType: 'single',
    stance: 'balanced',
    yieldThreshold: 10,
    buildFocus: 'versatile',
    weaponPath: [{ main: 'Practice Blade' }, { main: 'Volt Sabre' }],
    refinementPlan: [
      { tier: 'sharpen', hand: 'main', magnitude: 1 },
      { tier: 'sharpen', hand: 'main', magnitude: 1 },
      { tier: 'forge', hand: 'main', magnitude: 1 },
      { tier: 'forge', hand: 'main', magnitude: 1 },
    ],
    ...overrides,
  };
}

export function robot(slotIndex: number, overrides: Partial<RobotFacts> = {}): RobotFacts {
  return {
    robotId: 1000 + slotIndex,
    slotIndex,
    blueprintId: 100 + slotIndex,
    attributes: attributesAt(1),
    loadoutType: 'single',
    stance: 'balanced',
    yieldThreshold: 10,
    mainInventoryId: null,
    offhandInventoryId: null,
    stageIndex: 0,
    subscriptions: [],
    heldEventTypes: [],
    tuning: {},
    ...overrides,
  };
}

export function item(inventoryId: number, weaponName: string, overrides: Partial<InventoryFacts> = {}): InventoryFacts {
  return { inventoryId, weaponName, pricePaid: 50_000, createdAtMs: inventoryId, refinements: [], ...overrides };
}

export function refinements(...tiers: RefinementRow['tier'][]): RefinementRow[] {
  return tiers.map((tier) => ({ tier, magnitude: 1, targetAttribute: null }));
}

export function team(teamId: number, size: 2 | 3, memberRobotIds: number[], name = `Team ${teamId}`): TeamFacts {
  return { teamId, size, name, memberRobotIds };
}

export function stable(overrides: Partial<StableFacts> = {}): StableFacts {
  return {
    profileId: 1,
    userId: 1,
    catalogueKey: 'test-stable',
    seasonNumber: 1,
    phase: 'competitive',
    balance: 3_000_000,
    prestige: 0,
    facilities: facilities(),
    robots: [],
    inventory: [],
    teams: [],
    takenRobotNames: [],
    ...overrides,
  };
}

export function context(facts: StableFacts, overrides: Partial<GoalContext> = {}): GoalContext {
  return {
    target: 1,
    params: { targets: {} },
    blueprints: [blueprint(1), blueprint(2), blueprint(3)],
    weapons: weaponMap(),
    balance: facts.balance,
    ...overrides,
  };
}

/** A robot on stage `stage` of the default path, holding inventory item `inventoryId`. */
export function armedRobot(slotIndex: number, inventoryId: number, stage = 0, overrides: Partial<RobotFacts> = {}): RobotFacts {
  return robot(slotIndex, { mainInventoryId: inventoryId, stageIndex: stage, ...overrides });
}
