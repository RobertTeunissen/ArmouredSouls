/**
 * Fact projector (Spec #55, R11.4 support, design §7, §8.3, task 3.6).
 *
 * Pure: applies one PlannedAction to StableFacts and returns new facts, as if
 * the executor had run it and the facts had been reloaded. Turn_Preview, the
 * draft preview, the scenario projector and the conformance suite use it to
 * walk a turn without touching the database. The input is never mutated.
 *
 * What the projection mirrors:
 * - every charged step moves the balance by the planned cost (a sale by its
 *   planned proceeds); a refinement also adds its price to the item's
 *   `pricePaid`, as `refineWeapon` does;
 * - a robot purchase adds a robot at attribute level 1 with the blueprint's
 *   stance and yield; its fit-out sets the loadout, buys and equips the
 *   starting stage and registers every Team_Rule team the robot completes
 *   (Robot_Fitout step 6, design §9.1);
 * - `stageIndex` is re-derived with `matchedStageIndex` after every weapon
 *   change, exactly as the facts loader derives it.
 *
 * New ids are the highest existing id + 1, so a projection is deterministic.
 * Subscriptions and tuning are not projected: no Goal reads them.
 */
import { refinementMagnitudeForStorage } from '../economy/weaponRefinementService';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../shared/utils/robotAttributes';
import {
  blueprintForSlot,
  matchedStageIndex,
  type BlueprintFacts,
  type Hand,
  type InventoryFacts,
  type RobotFacts,
  type StableFacts,
} from './stableFacts';
import type { ChainStep, EquipSource, PlannedAction, StageStep } from './goals/goalTypes';
import { teamsDue } from './upkeep/teamUpkeep';
import type { TeamNames } from '../../types/automaton';

/** Attribute level of a newly bought robot. */
const NEW_ROBOT_ATTRIBUTE_LEVEL = 1;

export interface ProjectionContext {
  /** Ordered by slot. */
  blueprints: readonly BlueprintFacts[];
  /**
   * The profile's Team_Names. A Team_Rule team without a name is not
   * registered (the executor records that as a turn error). `null` (scenario
   * and draft preview of a fresh stable) names teams "2v2 Team 1", … .
   */
  teamNames: TeamNames | null;
}

/** Thrown when an action does not fit the facts (a planner defect). */
export class ProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectionError';
  }
}

/** Working copy: every nested array and record the projector writes is copied. */
function cloneFacts(facts: StableFacts): StableFacts {
  return {
    ...facts,
    facilities: { ...facts.facilities },
    robots: facts.robots.map((robot) => ({
      ...robot,
      attributes: { ...robot.attributes },
      subscriptions: [...robot.subscriptions],
      heldEventTypes: [...robot.heldEventTypes],
      tuning: { ...robot.tuning },
    })),
    inventory: facts.inventory.map((item) => ({ ...item, refinements: [...item.refinements] })),
    teams: facts.teams.map((team) => ({ ...team, memberRobotIds: [...team.memberRobotIds] })),
    takenRobotNames: [...facts.takenRobotNames],
  };
}

function nextId(ids: readonly number[]): number {
  return ids.reduce((max, id) => Math.max(max, id), 0) + 1;
}

function robotBySlot(facts: StableFacts, slotIndex: number): RobotFacts {
  const robot = facts.robots.find((r) => r.slotIndex === slotIndex);
  if (!robot) throw new ProjectionError(`No live robot in slot ${slotIndex}`);
  return robot;
}

function itemById(facts: StableFacts, inventoryId: number): InventoryFacts {
  const item = facts.inventory.find((i) => i.inventoryId === inventoryId);
  if (!item) throw new ProjectionError(`No inventory item ${inventoryId}`);
  return item;
}

function setHand(robot: RobotFacts, hand: Hand, inventoryId: number | null): void {
  if (hand === 'main') robot.mainInventoryId = inventoryId;
  else robot.offhandInventoryId = inventoryId;
}

function upgradeFacility(facts: StableFacts, facilityType: keyof StableFacts['facilities'], toLevel: number, cost: number): void {
  if (toLevel !== facts.facilities[facilityType] + 1) {
    throw new ProjectionError(`${facilityType} L${toLevel} does not follow L${facts.facilities[facilityType]}`);
  }
  facts.facilities[facilityType] = toLevel;
  facts.balance -= cost;
}

function sellWeapon(facts: StableFacts, inventoryId: number, proceeds: number): void {
  itemById(facts, inventoryId);
  facts.inventory = facts.inventory.filter((item) => item.inventoryId !== inventoryId);
  facts.balance += proceeds;
}

function buyWeapon(facts: StableFacts, weaponName: string, cost: number): number {
  const inventoryId = nextId(facts.inventory.map((item) => item.inventoryId));
  const createdAtMs = nextId(facts.inventory.map((item) => item.createdAtMs));
  facts.inventory.push({ inventoryId, weaponName, pricePaid: cost, createdAtMs, refinements: [] });
  facts.balance -= cost;
  return inventoryId;
}

function equipSource(source: EquipSource, purchased: ReadonlyMap<Hand, number>, hand: Hand): number {
  if (source.kind === 'inventory') return source.inventoryId;
  const inventoryId = purchased.get(hand);
  if (inventoryId === undefined) throw new ProjectionError(`No purchase for the ${hand} hand`);
  return inventoryId;
}

function refreshStage(facts: StableFacts, robot: RobotFacts, blueprints: readonly BlueprintFacts[]): void {
  const blueprint = blueprints.find((b) => b.blueprintId === robot.blueprintId);
  robot.stageIndex = blueprint ? matchedStageIndex(robot, blueprint, facts.inventory) : -1;
}

/**
 * Register every Team_Rule team that is due (Free_Upkeep team part, design
 * §8.7 item 1). Exported for the scenario projector, which runs it at turn
 * start and end as the real turn does.
 */
export function projectTeamUpkeep(facts: StableFacts, teamNames: TeamNames | null): StableFacts {
  const next = cloneFacts(facts);
  const names: TeamNames = teamNames ?? { twoVsTwo: [], threeVsThree: [] };
  for (const due of teamsDue(next, names)) {
    const name = teamNames === null ? `${due.size}v${due.size} Team ${due.index + 1}` : due.name;
    if (name === null) continue;
    next.teams.push({
      teamId: nextId(next.teams.map((team) => team.teamId)),
      size: due.size,
      name,
      memberRobotIds: [...due.robotIds],
    });
  }
  return next;
}

function applyChainStep(facts: StableFacts, step: ChainStep, slotIndex: number, ctx: ProjectionContext): StableFacts {
  switch (step.kind) {
    case 'weapon_sale':
      sellWeapon(facts, step.inventoryId, step.proceeds);
      return facts;
    case 'facility_upgrade':
      upgradeFacility(facts, step.facilityType, step.toLevel, step.cost);
      return facts;
    case 'robot_purchase': {
      const blueprint = blueprintForSlot(ctx.blueprints, slotIndex);
      if (!blueprint) throw new ProjectionError(`No blueprint for slot ${slotIndex}`);
      const attributes = {} as Record<RobotAttribute, number>;
      for (const attribute of ROBOT_ATTRIBUTES) attributes[attribute] = NEW_ROBOT_ATTRIBUTE_LEVEL;
      facts.robots.push({
        robotId: nextId(facts.robots.map((r) => r.robotId)),
        slotIndex,
        blueprintId: blueprint.blueprintId,
        attributes,
        loadoutType: 'single',
        stance: blueprint.stance,
        yieldThreshold: blueprint.yieldThreshold,
        mainInventoryId: null,
        offhandInventoryId: null,
        stageIndex: -1,
        subscriptions: [],
        heldEventTypes: [],
        tuning: {},
      });
      facts.robots.sort((a, b) => a.slotIndex - b.slotIndex);
      facts.takenRobotNames.push(step.robotName);
      facts.balance -= step.cost;
      return facts;
    }
    case 'fitout': {
      const robot = robotBySlot(facts, slotIndex);
      robot.loadoutType = step.loadoutType;
      const purchased = new Map<Hand, number>();
      for (const purchase of step.purchases) purchased.set(purchase.hand, buyWeapon(facts, purchase.weaponName, purchase.cost));
      for (const equip of step.equip) setHand(robot, equip.hand, equipSource(equip.source, purchased, equip.hand));
      refreshStage(facts, robot, ctx.blueprints);
      return projectTeamUpkeep(facts, ctx.teamNames);
    }
  }
}

function applyStageSteps(facts: StableFacts, robotSlot: number, steps: readonly StageStep[], ctx: ProjectionContext): void {
  const purchased = new Map<Hand, number>();
  for (const step of steps) {
    switch (step.kind) {
      case 'facility_upgrade':
        upgradeFacility(facts, step.facilityType, step.toLevel, step.cost);
        break;
      case 'weapon_sale':
        sellWeapon(facts, step.inventoryId, step.proceeds);
        break;
      case 'weapon_purchase':
        purchased.set(step.hand, buyWeapon(facts, step.weaponName, step.cost));
        break;
      case 'unequip':
        setHand(robotBySlot(facts, robotSlot), step.hand, null);
        break;
      case 'loadout_change':
        robotBySlot(facts, robotSlot).loadoutType = step.loadoutType;
        break;
      case 'equip':
        setHand(robotBySlot(facts, robotSlot), step.hand, equipSource(step.source, purchased, step.hand));
        break;
    }
  }
  refreshStage(facts, robotBySlot(facts, robotSlot), ctx.blueprints);
}

/** Apply one PlannedAction to `facts` and return the projected facts (R11.4). */
export function projectAction(facts: StableFacts, action: PlannedAction, ctx: ProjectionContext): StableFacts {
  let next = cloneFacts(facts);
  switch (action.kind) {
    case 'facility_upgrade':
      upgradeFacility(next, action.facilityType, action.toLevel, action.cost);
      return next;
    case 'attribute_upgrade': {
      const robot = robotBySlot(next, action.robotSlot);
      for (const [attribute, levels] of Object.entries(action.increments) as [RobotAttribute, number][]) {
        robot.attributes[attribute] = Math.floor(robot.attributes[attribute]) + levels;
      }
      next.balance -= action.cost;
      return next;
    }
    case 'robot_chain':
      for (const step of action.steps) next = applyChainStep(next, step, action.slotIndex, ctx);
      return next;
    case 'weapon_stage':
      applyStageSteps(next, action.robotSlot, action.steps, ctx);
      return next;
    case 'weapon_refinement': {
      for (const step of action.chain) upgradeFacility(next, step.facilityType, step.toLevel, step.cost);
      const item = itemById(next, action.inventoryId);
      item.refinements.push({
        tier: action.step.tier,
        magnitude: refinementMagnitudeForStorage(action.step.tier, action.step.magnitude),
        targetAttribute: action.step.targetAttribute ?? null,
      });
      item.pricePaid += action.refinementCost;
      next.balance -= action.refinementCost;
      return next;
    }
  }
}

/**
 * Charged steps of an action: every step that produces a Financial_Pair
 * (robot, facility level, attribute batch, weapon purchase, weapon sale,
 * refinement; R8.1). Equipping, unequipping and loadout changes are free.
 * The Turn_Budget counts these (R5.11).
 */
export function chargedStepCount(action: PlannedAction): number {
  switch (action.kind) {
    case 'facility_upgrade':
    case 'attribute_upgrade':
      return 1;
    case 'weapon_refinement':
      return action.chain.length + 1;
    case 'robot_chain':
      return action.steps.reduce((count, step) => count + (step.kind === 'fitout' ? step.purchases.length : 1), 0);
    case 'weapon_stage':
      return action.steps.filter((step) =>
        step.kind === 'facility_upgrade' || step.kind === 'weapon_sale' || step.kind === 'weapon_purchase').length;
  }
}
