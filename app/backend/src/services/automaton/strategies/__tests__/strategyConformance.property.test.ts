/**
 * Strategy conformance suite (Spec #55, R6.7, R14.2, design §14.1).
 *
 * Runs for every Strategy_Definition_File in the strategy directories under
 * test (the repository directory and the test fixture): fast-check draws
 * Goal_Targets within bounds, stable facts and blueprint sets, then plans and
 * projects up to one Turn_Budget of charged steps, asserting at every step:
 *
 * 1. every planned charged step costs at most the balance when planned;
 * 2. every planned action is of a known kind with valid targets (facility
 *    level sequence, maximum level and Prestige_Gate; attribute at most the
 *    academy cap; weapons fit the loadout; refinement valid);
 * 3. the walk ends within the Turn_Budget and evaluates at most one outcome
 *    per Goal;
 * 4. planning twice on equal inputs gives deep-equal results;
 * 5. no action maps to Manual_Repair or an income taxonomy;
 * 6. a facility Goal whose next level is prestige-gated is Blocked with
 *    `prestige_gate`.
 *
 * Because every file contains every required Goal type (R6.11), this suite
 * exercises every Goal factory in every strategy.
 */
import fc from 'fast-check';
import type { Weapon } from '../../../../../generated/prisma';
import { canEquipToSlot } from '../../../../utils/weaponValidation';
import { getCapForLevel } from '../../../../shared/utils/academyCaps';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../../../shared/utils/robotAttributes';
import {
  validateAttributeOnWeapon,
  validateAttributeStackCap,
  validateRefinementSlotAvailable,
  validateShieldCompatibility,
  type RefinementRow,
} from '../../../../shared/utils/weaponRefinement';
import { GROUP_ACADEMY, groupOfAttribute } from '../../buildFocus';
import { chargedStepCount, projectAction } from '../../factProjector';
import type { FacilityLevelStep, GoalOutcome, PlannedAction } from '../../goals/goalTypes';
import { facilityMaxLevel, quoteFacilityLevel, refinementLabLevelForTier, refinementStepCost } from '../../pricing';
import {
  AUTOMATON_FACILITY_TYPES,
  matchedStageIndex,
  rosterCapacityOf,
  storageCapacityOf,
  type BlueprintFacts,
  type FacilityType,
  type Hand,
  type InventoryFacts,
  type LoadoutType,
  type RobotFacts,
  type StableFacts,
  type TeamFacts,
} from '../../stableFacts';
import { teamsForSlots } from '../../teamRule';
import { calculateStorageCapacity } from '../../../../utils/storageCalculations';
import { planNextStep, type SimulationContext } from '../../turnPlanner';
import { TURN_ACTION_LIMIT } from '../../turnBudget';
import { loadStrategyRegistry } from '../registry';
import type { UpgradeStrategy } from '../strategyTypes';
import { BUILD_FOCUS_WEIGHTS } from '../../buildFocus';
import {
  SEED_WEAPON_MAP,
  STRATEGY_TEST_DIRECTORIES,
  blueprintSetArbitrary,
  starterBlueprintSets,
} from './helpers/strategyTestSupport';
import { loadCatalogueDirectory } from '../../automatonCatalogueService';

const STRATEGIES: UpgradeStrategy[] = STRATEGY_TEST_DIRECTORIES.flatMap((directory) =>
  loadStrategyRegistry({ directory, weightTable: BUILD_FOCUS_WEIGHTS }).all());

/** The starter catalogue blueprints (C04-3), padded to 11 slots. */
const STARTER_SETS = starterBlueprintSets(loadCatalogueDirectory({
  weapons: SEED_WEAPON_MAP,
  strategies: loadStrategyRegistry({ weightTable: BUILD_FOCUS_WEIGHTS }),
}).entries.map(({ entry }) => entry));

/** Hone and Augment steps planned across all strategies and runs. */
const seenRefinementTiers = new Set<string>();

afterAll(() => {
  // Generated and starter plans carry Hone and Augment fifth steps (C04-3).
  expect([...seenRefinementTiers].sort()).toEqual(['augment', 'hone']);
});

const NUM_RUNS = 100;
const KNOWN_ACTION_KINDS = new Set<PlannedAction['kind']>(['robot_chain', 'facility_upgrade', 'attribute_upgrade', 'weapon_stage', 'weapon_refinement']);
const FACILITY_TYPE_SET = new Set<string>(AUTOMATON_FACILITY_TYPES);

// ── Generators ───────────────────────────────────────────────────────

const OTHER_LOADOUT: Readonly<Record<LoadoutType, LoadoutType>> = {
  single: 'two_handed', two_handed: 'single', weapon_shield: 'single', dual_wield: 'single',
};

interface RobotDraw {
  stage: number;
  attributeSeeds: number[];
  appliedSteps: number;
}

function buildFacts(input: {
  balance: number;
  prestige: number;
  levels: number[];
  robotCount: number;
  blueprints: BlueprintFacts[];
  robotDraws: RobotDraw[];
  spareWeapons: string[];
  teamFlags: boolean[];
}): StableFacts {
  const facilities = {} as Record<FacilityType, number>;
  AUTOMATON_FACILITY_TYPES.forEach((type, i) => { facilities[type] = Math.min(input.levels[i], facilityMaxLevel(type)); });
  facilities.roster_expansion = Math.max(facilities.roster_expansion, input.robotCount - 1);

  const inventory: InventoryFacts[] = [];
  const addItem = (weaponName: string, rows: RefinementRow[] = []): number => {
    const inventoryId = inventory.length + 1;
    const cost = SEED_WEAPON_MAP.get(weaponName)?.cost ?? 0;
    inventory.push({ inventoryId, weaponName, pricePaid: cost, createdAtMs: inventoryId, refinements: rows });
    return inventoryId;
  };

  const robots: RobotFacts[] = [];
  for (let i = 0; i < input.robotCount; i++) {
    const blueprint = input.blueprints[i];
    const draw = input.robotDraws[i];
    const stage = Math.min(draw.stage, blueprint.weaponPath.length - 1);
    const attributes = {} as Record<RobotAttribute, number>;
    ROBOT_ATTRIBUTES.forEach((attribute, a) => {
      const cap = getCapForLevel(facilities[GROUP_ACADEMY[groupOfAttribute(attribute)]]);
      attributes[attribute] = 1 + (draw.attributeSeeds[a] % Math.min(50, cap));
    });
    let mainInventoryId: number | null = null;
    let offhandInventoryId: number | null = null;
    let loadoutType = blueprint.loadoutType;
    if (stage < 0) {
      loadoutType = OTHER_LOADOUT[blueprint.loadoutType];
    } else {
      const isFinal = stage === blueprint.weaponPath.length - 1;
      const rowsFor = (hand: Hand): RefinementRow[] => (isFinal
        ? blueprint.refinementPlan.filter((s) => s.hand === hand).slice(0, draw.appliedSteps)
          .map((s) => ({ tier: s.tier, magnitude: 1, targetAttribute: s.targetAttribute ?? null }))
        : []);
      const weapons = blueprint.weaponPath[stage];
      mainInventoryId = addItem(weapons.main, rowsFor('main'));
      if (weapons.offhand !== undefined) offhandInventoryId = addItem(weapons.offhand, rowsFor('offhand'));
    }
    robots.push({
      robotId: 1000 + i + 1,
      slotIndex: i + 1,
      blueprintId: blueprint.blueprintId,
      attributes,
      loadoutType,
      stance: blueprint.stance,
      yieldThreshold: blueprint.yieldThreshold,
      mainInventoryId,
      offhandInventoryId,
      stageIndex: -1,
      subscriptions: [],
      heldEventTypes: [],
      tuning: {},
    });
  }
  for (const name of input.spareWeapons) addItem(name);
  // Inventories within storage: raise the Storage Facility to fit (at most L10 holds 55).
  while (calculateStorageCapacity(facilities.storage_facility) < inventory.length && facilities.storage_facility < 10) {
    facilities.storage_facility++;
  }
  while (inventory.length > calculateStorageCapacity(facilities.storage_facility)) {
    const spareIndex = inventory.findIndex((item) => !robots.some((r) => r.mainInventoryId === item.inventoryId || r.offhandInventoryId === item.inventoryId));
    if (spareIndex === -1) break;
    inventory.splice(spareIndex, 1);
  }
  for (const robot of robots) {
    const blueprint = input.blueprints.find((b) => b.blueprintId === robot.blueprintId) as BlueprintFacts;
    robot.stageIndex = matchedStageIndex(robot, blueprint, inventory);
  }

  // Teams consistent with the Team_Rule: any subset of the teams whose slots are all alive.
  const teams: TeamFacts[] = teamsForSlots(robots.map((r) => r.slotIndex))
    .filter((_team, i) => input.teamFlags[i % input.teamFlags.length])
    .map((team, i) => ({
      teamId: i + 1,
      size: team.size,
      name: `Team ${i + 1}`,
      memberRobotIds: team.slots.map((slot) => 1000 + slot),
    }));

  return {
    profileId: 1,
    userId: 1,
    catalogueKey: 'conformance',
    seasonNumber: 1,
    phase: 'competitive',
    balance: input.balance,
    prestige: input.prestige,
    facilities,
    robots,
    inventory,
    teams,
    takenRobotNames: [],
  };
}

const seedWeaponNames = [...SEED_WEAPON_MAP.keys()];

const scenarioArbitrary = fc.record({
  balance: fc.integer({ min: -500_000, max: 20_000_000 }),
  prestige: fc.integer({ min: 0, max: 60_000 }),
  levels: fc.array(fc.integer({ min: 0, max: 10 }), { minLength: AUTOMATON_FACILITY_TYPES.length, maxLength: AUTOMATON_FACILITY_TYPES.length }),
  robotCount: fc.integer({ min: 0, max: 11 }),
  // Generated sets, or one of the 11 starter catalogue sets (design §14.1).
  blueprints: fc.oneof(blueprintSetArbitrary(11), fc.constantFrom(...STARTER_SETS)),
  robotDraws: fc.array(fc.record({
    stage: fc.integer({ min: -1, max: 3 }),
    attributeSeeds: fc.array(fc.nat(), { minLength: ROBOT_ATTRIBUTES.length, maxLength: ROBOT_ATTRIBUTES.length }),
    appliedSteps: fc.integer({ min: 0, max: 5 }),
  }), { minLength: 11, maxLength: 11 }),
  spareWeapons: fc.array(fc.constantFrom(...seedWeaponNames), { maxLength: 4 }),
  teamFlags: fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
  targetSeeds: fc.array(fc.nat(), { minLength: 40, maxLength: 40 }),
  // One case in three is a late-game stable (see `matureDraw`).
  mature: fc.integer({ min: 0, max: 2 }).map((n) => n === 0),
});

type ScenarioDraw = typeof scenarioArbitrary extends fc.Arbitrary<infer T> ? T : never;

const ACADEMIES = new Set<FacilityType>(Object.values(GROUP_ACADEMY));

/**
 * A late-game stable for the drawn Goal_Targets: every facility at least at
 * its highest facility-Goal target (academies at L10), the highest robots
 * target alive and every attribute at 50, so the walk reaches the Goals at
 * the bottom of the Build_Order (weapons, refine) that a uniform draw almost
 * never gets to. Weapon stages, prestige, balance and inventories stay drawn.
 */
function matureDraw(draw: ScenarioDraw, strategy: UpgradeStrategy, targets: Readonly<Record<string, number>>): ScenarioDraw {
  const levels = AUTOMATON_FACILITY_TYPES.map((type, i) => {
    if (ACADEMIES.has(type)) return 10;
    const goalTargets = strategy.buildOrder.filter((d) => d.facilityType === type).map((d) => targets[d.id]);
    return Math.max(draw.levels[i], ...goalTargets);
  });
  const robotCount = Math.max(draw.robotCount, ...strategy.buildOrder.filter((d) => d.type === 'robots').map((d) => targets[d.id]));
  return {
    ...draw,
    levels,
    robotCount,
    robotDraws: draw.robotDraws.map((robot) => ({ ...robot, attributeSeeds: robot.attributeSeeds.map(() => 49) })),
  };
}

// ── Assertions ───────────────────────────────────────────────────────

function asWeapon(name: string): Weapon {
  const weapon = SEED_WEAPON_MAP.get(name);
  if (!weapon) throw new Error(`Unknown weapon ${name}`);
  return { handsRequired: weapon.handsRequired, weaponType: weapon.weaponType } as unknown as Weapon;
}

function expectWeaponsFitLoadout(facts: StableFacts): void {
  for (const robot of facts.robots) {
    for (const [hand, inventoryId] of [['main', robot.mainInventoryId], ['offhand', robot.offhandInventoryId]] as const) {
      if (inventoryId === null) continue;
      const item = facts.inventory.find((i) => i.inventoryId === inventoryId);
      expect(item).toBeDefined();
      expect(canEquipToSlot(asWeapon(item?.weaponName ?? ''), hand, robot.loadoutType).canEquip).toBe(true);
    }
  }
}

function expectFacilityStepsValid(facts: StableFacts, steps: readonly FacilityLevelStep[]): void {
  const levels = { ...facts.facilities };
  for (const step of steps) {
    expect(FACILITY_TYPE_SET.has(step.facilityType)).toBe(true);
    expect(step.toLevel).toBe(levels[step.facilityType] + 1);
    expect(step.toLevel).toBeLessThanOrEqual(facilityMaxLevel(step.facilityType));
    const quote = quoteFacilityLevel(step.facilityType, levels[step.facilityType], facts.prestige);
    expect(quote.kind).toBe('available');
    if (quote.kind === 'available') expect(step.cost).toBe(quote.cost);
    levels[step.facilityType] = step.toLevel;
  }
}

function facilityStepsOf(action: PlannedAction): FacilityLevelStep[] {
  switch (action.kind) {
    case 'facility_upgrade': return [action];
    case 'robot_chain': return action.steps.filter((s): s is Extract<typeof s, { kind: 'facility_upgrade' }> => s.kind === 'facility_upgrade');
    case 'weapon_stage': return action.steps.filter((s): s is Extract<typeof s, { kind: 'facility_upgrade' }> => s.kind === 'facility_upgrade');
    case 'weapon_refinement': return action.chain;
    case 'attribute_upgrade': return [];
  }
}

function expectActionValid(before: StableFacts, after: StableFacts, action: PlannedAction, ctx: SimulationContext): void {
  expect(KNOWN_ACTION_KINDS.has(action.kind)).toBe(true);
  expectFacilityStepsValid(before, facilityStepsOf(action));

  switch (action.kind) {
    case 'attribute_upgrade': {
      const robot = before.robots.find((r) => r.slotIndex === action.robotSlot);
      expect(robot).toBeDefined();
      for (const [attribute, levels] of Object.entries(action.increments) as [RobotAttribute, number][]) {
        expect(levels).toBeGreaterThan(0);
        const cap = getCapForLevel(before.facilities[GROUP_ACADEMY[groupOfAttribute(attribute)]]);
        expect(Math.floor(robot?.attributes[attribute] ?? 0) + levels).toBeLessThanOrEqual(Math.min(cap, 50));
      }
      break;
    }
    case 'robot_chain': {
      expect(ctx.blueprints.some((b) => b.slotIndex === action.slotIndex)).toBe(true);
      expect(after.robots.length).toBe(before.robots.length + 1);
      expect(after.robots.length).toBeLessThanOrEqual(rosterCapacityOf(after));
      const robot = after.robots.find((r) => r.slotIndex === action.slotIndex);
      expect(robot?.mainInventoryId).not.toBeNull();
      expect(robot?.stageIndex).toBeGreaterThanOrEqual(0);
      break;
    }
    case 'weapon_stage': {
      const robot = after.robots.find((r) => r.slotIndex === action.robotSlot);
      expect(robot?.stageIndex).toBe(action.toStage);
      break;
    }
    case 'weapon_refinement': {
      const robot = before.robots.find((r) => r.slotIndex === action.robotSlot);
      const blueprint = ctx.blueprints.find((b) => b.blueprintId === robot?.blueprintId);
      expect(robot?.stageIndex).toBe((blueprint?.weaponPath.length ?? 0) - 1);
      const handId = action.step.hand === 'main' ? robot?.mainInventoryId : robot?.offhandInventoryId;
      expect(handId).toBe(action.inventoryId);
      const item = before.inventory.find((i) => i.inventoryId === action.inventoryId) as InventoryFacts;
      const refinementLab = action.chain.length > 0 ? action.chain[action.chain.length - 1].toLevel : before.facilities.refinement_lab;
      expect(action.chain.every((step) => step.facilityType === 'refinement_lab')).toBe(true);
      expect(refinementLab).toBeGreaterThanOrEqual(refinementLabLevelForTier(action.step.tier));
      expect(validateRefinementSlotAvailable(item.refinements, action.step.tier).ok).toBe(true);
      expect(validateShieldCompatibility(SEED_WEAPON_MAP.get(item.weaponName)?.weaponType ?? '', action.step.tier).ok).toBe(true);
      if (action.step.tier === 'hone' || action.step.tier === 'augment') {
        const attribute = action.step.targetAttribute as RobotAttribute;
        const bonus = SEED_WEAPON_MAP.get(item.weaponName)?.bonuses[attribute] ?? 0;
        expect(validateAttributeOnWeapon(bonus, item.refinements, attribute, action.step.tier).ok).toBe(true);
        expect(validateAttributeStackCap(bonus, item.refinements, attribute, action.step.magnitude).ok).toBe(true);
        seenRefinementTiers.add(action.step.tier);
      }
      const existing = item.refinements.filter((r) => r.tier === action.step.tier).length;
      expect(action.refinementCost).toBe(refinementStepCost(action.step.tier, action.step.magnitude, existing));
      break;
    }
    case 'facility_upgrade':
      break;
  }
  expect(after.inventory.length).toBeLessThanOrEqual(storageCapacityOf(after));
  expectWeaponsFitLoadout(after);
}

function expectFacilityGatesBlocked(facts: StableFacts, strategy: UpgradeStrategy, outcomes: readonly GoalOutcome[]): void {
  outcomes.forEach((outcome, i) => {
    const definition = strategy.buildOrder[i];
    if (definition.type !== 'facility' || !definition.facilityType || outcome.kind === 'satisfied') return;
    const quote = quoteFacilityLevel(definition.facilityType, facts.facilities[definition.facilityType], facts.prestige);
    if (quote.kind === 'prestige_gate') expect(outcome).toMatchObject({ kind: 'blocked', reason: 'prestige_gate' });
  });
}

describe.each(STRATEGIES.map((s) => [`${s.key}.v${s.version}`, s] as const))('strategy conformance: %s (R6.7, R14.2)', (_name, strategy) => {
  it('every Goal type of the strategy is a Goal_Library type', () => {
    for (const definition of strategy.buildOrder) expect(typeof definition.goal.evaluate).toBe('function');
  });

  it('plans only affordable, valid, deterministic steps within the Turn_Budget', () => {
    const seenActionKinds = new Set<PlannedAction['kind']>();
    fc.assert(fc.property(scenarioArbitrary, (draw) => {
      const targets: Record<string, number> = {};
      strategy.buildOrder.forEach((definition, i) => {
        const span = definition.bounds.max - definition.bounds.min + 1;
        targets[definition.id] = definition.bounds.min + (draw.targetSeeds[i % draw.targetSeeds.length] % span);
      });
      const facts = buildFacts(draw.mature ? matureDraw(draw, strategy, targets) : draw);
      // R3.7: robots targets never exceed the blueprints (11 here).
      const ctx: SimulationContext = { params: { targets }, blueprints: draw.blueprints, weapons: SEED_WEAPON_MAP, teamNames: null };

      let current = facts;
      let charged = 0;
      let iterations = 0;
      for (;;) {
        const plan = planNextStep(current, strategy, ctx);
        expect(planNextStep(structuredClone(current), strategy, ctx)).toEqual(plan);
        expect(plan.outcomes.length).toBeLessThanOrEqual(strategy.buildOrder.length);
        expectFacilityGatesBlocked(current, strategy, plan.outcomes);
        if (plan.next === null || plan.next.kind === 'saving') break;
        if (charged >= TURN_ACTION_LIMIT) break;

        expect(plan.next.cost).toBeLessThanOrEqual(current.balance);
        const after = projectAction(current, plan.next.action, ctx);
        expectActionValid(current, after, plan.next.action, ctx);
        seenActionKinds.add(plan.next.action.kind);
        charged += chargedStepCount(plan.next.action);
        current = after;
        iterations++;
        // The walk terminates: every action costs at least one charged step except a
        // Weapon_Reuse stage change, of which there are at most 4 stages per robot.
        expect(iterations).toBeLessThanOrEqual(TURN_ACTION_LIMIT + 11 * 4);
      }
    }), { numRuns: NUM_RUNS });
    // Every Goal factory of the strategy planned at least one action across the runs.
    expect([...seenActionKinds].sort()).toEqual([...KNOWN_ACTION_KINDS].sort());
  });
});
