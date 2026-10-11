/**
 * Shared support for the strategy-layer suites (Spec #55). Not a test file.
 *
 * - `SEED_WEAPONS`: the real weapon catalogue (`WEAPON_DEFINITIONS` of the
 *   seed) as planner WeaponFacts, so projections price real weapons.
 * - Blueprint generators: valid Robot_Blueprints for every loadout, used by
 *   the conformance and scenario suites until the starter catalogue arrives.
 * - `STRATEGY_TEST_DIRECTORIES`: every directory whose files the generic
 *   suites must cover: the real strategy directory and the test fixture.
 */
import fs from 'fs';
import path from 'path';
import fc from 'fast-check';
import { WEAPON_DEFINITIONS } from '../../../../../../prisma/seed';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../../../../shared/utils/robotAttributes';
import type { BuildFocusKey, RefinementStep, WeaponStage } from '../../../../../types/automaton';
import type { BlueprintFacts, LoadoutType, Stance, WeaponFacts } from '../../../stableFacts';
import { STRATEGY_DIRECTORY } from '../../registry';

export const FIXTURE_STRATEGY_DIRECTORY = path.join(__dirname, '..', 'fixtures');

/** Directories the generic suites iterate (R6.7): the repository files and the test fixture. */
export const STRATEGY_TEST_DIRECTORIES: readonly string[] = [STRATEGY_DIRECTORY, FIXTURE_STRATEGY_DIRECTORY];

/** `{ directory, file }` for every `*.json` in the test directories. */
export function strategyFilesUnderTest(): { directory: string; file: string }[] {
  return STRATEGY_TEST_DIRECTORIES.flatMap((directory) =>
    (fs.existsSync(directory) ? fs.readdirSync(directory) : [])
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => ({ directory, file })));
}

type SeedWeapon = (typeof WEAPON_DEFINITIONS)[number];

function bonusesOf(row: SeedWeapon): Partial<Record<RobotAttribute, number>> {
  const record = row as unknown as Record<string, unknown>;
  const bonuses: Partial<Record<RobotAttribute, number>> = {};
  for (const attribute of ROBOT_ATTRIBUTES) {
    const value = record[`${attribute}Bonus`];
    if (typeof value === 'number' && value !== 0) bonuses[attribute] = value;
  }
  return bonuses;
}

export const SEED_WEAPONS: readonly WeaponFacts[] = WEAPON_DEFINITIONS.map((row, index) => ({
  weaponId: index + 1,
  name: row.name,
  cost: row.cost,
  weaponType: row.weaponType,
  handsRequired: row.handsRequired,
  rangeBand: row.rangeBand,
  bonuses: bonusesOf(row),
}));

export const SEED_WEAPON_MAP: ReadonlyMap<string, WeaponFacts> = new Map(SEED_WEAPONS.map((w) => [w.name, w]));

const byHands = (hands: string): WeaponFacts[] =>
  SEED_WEAPONS.filter((w) => w.handsRequired === hands).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
const ONE_HANDED = byHands('one');
const TWO_HANDED = byHands('two');
const SHIELDS = byHands('shield');

const BUILD_FOCUS_KEYS: readonly BuildFocusKey[] = ['bruiser', 'deadeye', 'warden', 'sprinter', 'tactician', 'versatile'];
const LOADOUTS: readonly LoadoutType[] = ['single', 'weapon_shield', 'dual_wield', 'two_handed'];
const STANCES: readonly Stance[] = ['offensive', 'defensive', 'balanced'];

/** A Weapon_Path of `stages` stages for `loadout`: cheap first stage, dearer later stages. */
function weaponPathFor(loadout: LoadoutType, stages: number, variant: number): WeaponStage[] {
  // Stage 0 is a starter (one of the two cheapest); later stages climb to the dearest.
  const pick = (list: readonly WeaponFacts[], stage: number, shift: number): string => {
    if (stage === 0) return list[(variant + shift) % 2].name;
    const index = list.length - 1 - (stages - 1 - stage) * 2 - ((variant + shift) % 2);
    return list[Math.max(2, index)].name;
  };
  return Array.from({ length: stages }, (_unused, stage): WeaponStage => {
    switch (loadout) {
      case 'two_handed': return { main: pick(TWO_HANDED, stage, 0) };
      case 'weapon_shield': return { main: pick(ONE_HANDED, stage, 0), offhand: pick(SHIELDS, stage, 0) };
      case 'dual_wield': return { main: pick(ONE_HANDED, stage, 0), offhand: pick(ONE_HANDED, stage, 1) };
      case 'single': return { main: pick(ONE_HANDED, stage, 0) };
    }
  });
}

/**
 * A fifth step valid for `weaponName` (decision 36): a Hone +1 on its first
 * bonus that stays within +10, else an Augment +1 on an attribute it lacks.
 */
function fifthStepFor(weaponName: string, hand: 'main' | 'offhand', variant: number): RefinementStep {
  const bonuses = SEED_WEAPON_MAP.get(weaponName)?.bonuses ?? {};
  const honeable = (Object.entries(bonuses) as [RobotAttribute, number][]).filter(([, value]) => value + 1 <= 10);
  if (honeable.length > 0 && variant % 2 === 0) {
    return { tier: 'hone', hand, targetAttribute: honeable[0][0], magnitude: 1 };
  }
  const absent = ROBOT_ATTRIBUTES.find((attribute) => bonuses[attribute] === undefined) as RobotAttribute;
  return { tier: 'augment', hand, targetAttribute: absent, magnitude: 1 };
}

/**
 * Every Sharpen and Forge per non-shield weapon of the final stage (decision
 * 35), then a Hone or Augment fifth step per weapon (Hone +1 on the shield).
 */
function refinementPlanFor(loadout: LoadoutType, finalStage: WeaponStage, variant: number): RefinementStep[] {
  const dps = (h: 'main' | 'offhand'): RefinementStep[] => [
    { tier: 'sharpen', hand: h, magnitude: 1 },
    { tier: 'sharpen', hand: h, magnitude: 1 },
    { tier: 'forge', hand: h, magnitude: 1 },
    { tier: 'forge', hand: h, magnitude: 1 },
  ];
  const main = [...dps('main'), fifthStepFor(finalStage.main, 'main', variant)];
  if (loadout === 'dual_wield' && finalStage.offhand) return [...main, ...dps('offhand'), fifthStepFor(finalStage.offhand, 'offhand', variant + 1)];
  if (loadout === 'weapon_shield' && finalStage.offhand) return [...main, fifthStepFor(finalStage.offhand, 'offhand', 0)];
  return main;
}

/** A deterministic valid blueprint for `slotIndex`. */
export function generatedBlueprint(
  slotIndex: number,
  loadout: LoadoutType = LOADOUTS[(slotIndex - 1) % LOADOUTS.length],
  stages = 2,
  buildFocus: BuildFocusKey = BUILD_FOCUS_KEYS[(slotIndex - 1) % BUILD_FOCUS_KEYS.length],
): BlueprintFacts {
  const weaponPath = weaponPathFor(loadout, stages, slotIndex);
  return {
    blueprintId: 500 + slotIndex,
    slotIndex,
    robotName: `Scenario Unit ${slotIndex}`,
    imageUrl: null,
    loadoutType: loadout,
    stance: STANCES[(slotIndex - 1) % STANCES.length],
    yieldThreshold: 10,
    buildFocus,
    weaponPath,
    refinementPlan: refinementPlanFor(loadout, weaponPath[weaponPath.length - 1], slotIndex),
  };
}

/**
 * The starter catalogue's blueprints as planner facts, one 11-slot set per
 * Catalogue_Entry: the entry's blueprints in their slots, generated
 * blueprints in the slots it does not have (design §14.1, C04-3).
 */
export function starterBlueprintSets(entries: readonly { blueprints: readonly CatalogueBlueprintLike[] }[]): BlueprintFacts[][] {
  return entries.map((entry) => Array.from({ length: 11 }, (_unused, i): BlueprintFacts => {
    const blueprint = entry.blueprints.find((b) => b.slot === i + 1);
    if (!blueprint) return generatedBlueprint(i + 1);
    return {
      blueprintId: 500 + blueprint.slot,
      slotIndex: blueprint.slot,
      robotName: blueprint.robotName,
      imageUrl: null,
      loadoutType: blueprint.loadoutType,
      stance: blueprint.stance,
      yieldThreshold: blueprint.yieldThreshold,
      buildFocus: blueprint.buildFocus,
      weaponPath: blueprint.weaponPath.map((stage) => ({ ...stage })),
      refinementPlan: blueprint.refinementPlan.map((step) => ({ ...step })),
    };
  }));
}

/** The Catalogue_Entry blueprint fields `starterBlueprintSets` reads. */
export interface CatalogueBlueprintLike {
  slot: number;
  robotName: string;
  loadoutType: LoadoutType;
  stance: Stance;
  yieldThreshold: number;
  buildFocus: BuildFocusKey;
  weaponPath: readonly WeaponStage[];
  refinementPlan: readonly RefinementStep[];
}

/** Eleven generated blueprints covering every loadout and Build_Focus. */
export function generatedBlueprintSet(count = 11): BlueprintFacts[] {
  return Array.from({ length: count }, (_unused, i) => generatedBlueprint(i + 1));
}

/** fast-check: a valid blueprint set of `count` slots. */
export function blueprintSetArbitrary(count: number): fc.Arbitrary<BlueprintFacts[]> {
  return fc.array(
    fc.record({
      loadout: fc.constantFrom(...LOADOUTS),
      stages: fc.integer({ min: 1, max: 4 }),
      buildFocus: fc.constantFrom(...BUILD_FOCUS_KEYS),
    }),
    { minLength: count, maxLength: count },
  ).map((slots) => slots.map((slot, i) => generatedBlueprint(i + 1, slot.loadout, slot.stages, slot.buildFocus)));
}
