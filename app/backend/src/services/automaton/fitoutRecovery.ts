/**
 * Fit-out recovery (PR #534 follow-up to Spec #55 design §9.1).
 *
 * A Robot_Chain buys the robot and fits it out in separate charged
 * transactions (R7.7). When the fit-out throws after the robot committed (a
 * weapon lookup, purchase or equip failure), the robot exists without its
 * weapons, fails the shared loadout readiness rule and is never scheduled.
 *
 * At the start of every Automaton_Turn, before the planner can buy anything,
 * `resumeIncompleteFitouts` finds the stable's robots that fail
 * `evaluateLoadoutReadiness` (the rule `checkSchedulingReadiness` and the
 * battle-time `evaluateCombatEntry` use) and
 * resumes their fit-out:
 * - the blueprint loadout through `changeLoadoutType` (skipped when it matches);
 * - for every empty hand of the target stage, an unequipped inventory item of
 *   that name first (Weapon_Reuse), a purchase only for what is still missing;
 * - storage room for those purchases by the Storage_Overflow_Rule, never
 *   selling an item this or another unready robot will equip from inventory.
 *
 * Every charged step goes through the same primitives as the Robot_Chain
 * (`weaponPurchaseService`, `weaponSaleService`, `facilityUpgradeService` and
 * so `Credit_Mutation_Service` with its Financial_Pair), on the turn's cursor.
 * Idempotent: a weapon bought by a failed attempt stays in inventory and is
 * equipped from there next turn, so nothing is bought twice. Each robot is
 * tried once per turn; a failure is logged and left for the next turn, never
 * retried in a loop. Ready robots are not touched.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { evaluateLoadoutReadiness } from '../../shared/utils/loadout-readiness';
import { invalidateUserRobotsCache } from '../robot/robotQueryService';
import { discountedWeaponPrice } from './pricing';
import {
  buyFacilityLevel,
  buyWeapon,
  equipHand,
  sellInventoryItem,
  setLoadout,
  type ExecutionContext,
  type ExecutionCursor,
} from './executionSteps';
import { planStartingStage } from './goals/robotCountGoal';
import { planStorageRoom, stageHands, takeReusable, unequippedItems, weaponByName } from './goals/goalSupport';
import type { EquipSource, WeaponPurchasePart, WeaponSaleStep, FacilityLevelStep } from './goals/goalTypes';
import { checkTurnBudget } from './turnBudget';
import { loadStableFacts, reloadOptions, type BlueprintFacts, type Hand, type InventoryFacts, type RobotFacts, type StableFacts } from './stableFacts';

/** Goal id recorded on the charged steps (Turn_Record actions, audit context). */
export const FITOUT_RECOVERY_GOAL_ID = 'fitout_recovery';

/** Whether a robot's loadout passes the shared battle-readiness rule. */
export function isLoadoutReady(robot: Pick<RobotFacts, 'loadoutType' | 'mainInventoryId' | 'offhandInventoryId'>): boolean {
  return evaluateLoadoutReadiness({
    loadoutType: robot.loadoutType,
    mainWeaponId: robot.mainInventoryId,
    offhandWeaponId: robot.offhandInventoryId,
  }).isReady;
}

export interface FitoutRecoveryPlan {
  robotId: number;
  slotIndex: number;
  loadoutType: BlueprintFacts['loadoutType'];
  storageSteps: (WeaponSaleStep | (FacilityLevelStep & { facilityType: 'storage_facility' }))[];
  purchases: WeaponPurchasePart[];
  equip: { hand: Hand; weaponName: string; source: EquipSource }[];
  /** Credits the plan charges (storage levels and purchases; sale proceeds not counted). */
  cost: number;
}

export type FitoutRecoveryDecision =
  | { kind: 'plan'; plan: FitoutRecoveryPlan }
  | { kind: 'skip'; reason: string };

function heldWeaponName(facts: StableFacts, inventoryId: number | null): string | undefined {
  if (inventoryId === null) return undefined;
  return facts.inventory.find((item) => item.inventoryId === inventoryId)?.weaponName;
}

/**
 * Target stage: the stage of the main weapon the robot already holds (so the
 * off hand matches it), otherwise the starting stage the Robot_Chain fits.
 */
function targetStageIndex(facts: StableFacts, robot: RobotFacts, blueprint: BlueprintFacts): number {
  const heldMain = heldWeaponName(facts, robot.mainInventoryId);
  if (heldMain !== undefined) {
    for (let i = blueprint.weaponPath.length - 1; i >= 0; i--) {
      if (blueprint.weaponPath[i].main === heldMain) return i;
    }
  }
  return planStartingStage(facts, blueprint.weaponPath).stageIndex;
}

/** The hands of the robot's target stage that hold nothing yet (a held hand is left as it is). */
function emptyStageHands(facts: StableFacts, robot: RobotFacts, blueprint: BlueprintFacts): { hand: Hand; weaponName: string }[] {
  const stage = blueprint.weaponPath[targetStageIndex(facts, robot, blueprint)];
  return stageHands(stage).filter(({ hand }) => (hand === 'main' ? robot.mainInventoryId : robot.offhandInventoryId) === null);
}

/**
 * Reserve, from `pool`, the inventory items the stable's other unready robots
 * will equip by Weapon_Reuse when their recovery runs. A storage sale for this
 * robot must not remove one of them, or that robot would buy it again.
 */
function reserveForOtherUnreadyRobots(
  facts: StableFacts,
  robot: RobotFacts,
  blueprints: readonly BlueprintFacts[],
  pool: InventoryFacts[],
  reserved: Set<number>,
): void {
  for (const other of facts.robots) {
    if (other.robotId === robot.robotId || isLoadoutReady(other)) continue;
    const blueprint = blueprints.find((b) => b.blueprintId === other.blueprintId);
    if (!blueprint || blueprint.weaponPath.length === 0) continue;
    for (const { weaponName } of emptyStageHands(facts, other, blueprint)) {
      const reused = takeReusable(pool, weaponName);
      if (reused) reserved.add(reused.inventoryId);
    }
  }
}

/**
 * Pure plan that brings one unready robot back to its blueprint's starting
 * loadout. The storage room it plans never sells an item this robot or any
 * other unready robot of the stable will equip from inventory.
 */
export function planFitoutRecovery(
  facts: StableFacts,
  robot: RobotFacts,
  blueprints: readonly BlueprintFacts[],
  ctx: Pick<ExecutionContext, 'weapons'>,
): FitoutRecoveryDecision {
  const blueprint = blueprints.find((b) => b.blueprintId === robot.blueprintId);
  if (!blueprint) return { kind: 'skip', reason: 'no_blueprint' };
  if (blueprint.weaponPath.length === 0) return { kind: 'skip', reason: 'empty_weapon_path' };

  const pool = unequippedItems(facts);
  const reserved = new Set<number>();
  const purchases: WeaponPurchasePart[] = [];
  const equip: FitoutRecoveryPlan['equip'] = [];
  const workshopLevel = facts.facilities.weapons_workshop;

  // This robot picks first (it is the one being recovered), then the others reserve theirs.
  for (const { hand, weaponName } of emptyStageHands(facts, robot, blueprint)) {
    const reused = takeReusable(pool, weaponName);
    if (reused) {
      reserved.add(reused.inventoryId);
      equip.push({ hand, weaponName, source: { kind: 'inventory', inventoryId: reused.inventoryId } });
    } else {
      const cost = discountedWeaponPrice(weaponByName(ctx, weaponName).cost, workshopLevel);
      purchases.push({ hand, weaponName, cost });
      equip.push({ hand, weaponName, source: { kind: 'purchase' } });
    }
  }
  reserveForOtherUnreadyRobots(facts, robot, blueprints, pool, reserved);

  const storage = planStorageRoom(facts, blueprints, purchases.length, reserved);
  if (storage.kind === 'blocked') return { kind: 'skip', reason: storage.reason };

  const cost = storage.cost + purchases.reduce((sum, p) => sum + p.cost, 0);
  return {
    kind: 'plan',
    plan: {
      robotId: robot.robotId,
      slotIndex: robot.slotIndex,
      loadoutType: blueprint.loadoutType,
      storageSteps: storage.steps,
      purchases,
      equip,
      cost,
    },
  };
}

async function executePlan(plan: FitoutRecoveryPlan, ctx: ExecutionContext, cursor: ExecutionCursor): Promise<void> {
  const goalId = FITOUT_RECOVERY_GOAL_ID;
  await setLoadout(ctx, plan.robotId, plan.loadoutType);
  for (const step of plan.storageSteps) {
    if (step.kind === 'weapon_sale') await sellInventoryItem(ctx, cursor, goalId, step.inventoryId);
    else await buyFacilityLevel(ctx, cursor, goalId, step.facilityType, step.toLevel);
  }
  const purchased = new Map<Hand, number>();
  for (const purchase of plan.purchases) {
    purchased.set(purchase.hand, await buyWeapon(ctx, cursor, goalId, purchase.weaponName));
  }
  for (const entry of plan.equip) {
    const inventoryId = entry.source.kind === 'inventory' ? entry.source.inventoryId : purchased.get(entry.hand);
    if (inventoryId === undefined) throw new Error(`Fit-out recovery of slot ${plan.slotIndex}: no purchase for the ${entry.hand} hand`);
    await equipHand(ctx, plan.robotId, entry.hand, inventoryId);
  }
}

export interface FitoutRecoveryBudget {
  /** `Date.now()` when the turn started. */
  startedAtMs: number;
  now: () => number;
}

export interface FitoutRecoveryResult {
  /** Facts after recovery (the input when nothing ran). */
  facts: StableFacts;
  /** Robots that are battle-ready again. */
  resumed: number[];
  /** Robots still unready (skipped, unaffordable or failed); retried next turn. */
  unresolved: number[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Resume the fit-out of every unready robot of the stable (see file header).
 * Never throws for a robot's failure; the turn carries on with the others.
 */
export async function resumeIncompleteFitouts(
  facts: StableFacts,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  budget: FitoutRecoveryBudget,
): Promise<FitoutRecoveryResult> {
  const unready = facts.robots.filter((robot) => !isLoadoutReady(robot)).map((robot) => robot.robotId);
  if (unready.length === 0) return { facts, resumed: [], unresolved: [] };

  const label = `[Automaton] ${facts.catalogueKey} (user ${facts.userId})`;
  const resumed: number[] = [];
  const unresolved: number[] = [];
  let current = facts;

  for (const robotId of unready) {
    const robot = current.robots.find((r) => r.robotId === robotId);
    if (!robot || isLoadoutReady(robot)) continue;

    let decision: FitoutRecoveryDecision;
    try {
      decision = planFitoutRecovery(current, robot, ctx.blueprints, ctx);
    } catch (error) {
      logger.error(`${label}: fit-out recovery of robot ${robotId} (slot ${robot.slotIndex}) could not be planned — ${errorMessage(error)}`);
      unresolved.push(robotId);
      continue;
    }
    if (decision.kind === 'skip') {
      logger.error(`${label}: robot ${robotId} (slot ${robot.slotIndex}) is not battle-ready and its fit-out cannot resume: ${decision.reason}`);
      unresolved.push(robotId);
      continue;
    }
    const { plan } = decision;
    if (plan.cost > current.balance) {
      logger.warn(`${label}: robot ${robotId} (slot ${robot.slotIndex}) is not battle-ready; fit-out needs ₡${plan.cost.toLocaleString()}, balance ₡${current.balance.toLocaleString()}`);
      unresolved.push(robotId);
      continue;
    }
    const chargedSteps = plan.storageSteps.length + plan.purchases.length;
    if (checkTurnBudget({ chargedActions: cursor.chargedSteps, startedAtMs: budget.startedAtMs }, budget.now(), chargedSteps).exhausted) {
      logger.warn(`${label}: turn budget spent before the fit-out recovery of robot ${robotId}; next turn resumes it`);
      unresolved.push(robotId);
      continue;
    }

    logger.warn(`${label}: robot ${robotId} (slot ${robot.slotIndex}) is not battle-ready; resuming its fit-out (${plan.equip.length - plan.purchases.length} from inventory, ${plan.purchases.length} to buy)`);
    try {
      await executePlan(plan, ctx, cursor);
    } catch (error) {
      logger.error(`${label}: fit-out recovery of robot ${robotId} (slot ${robot.slotIndex}) failed — ${errorMessage(error)}`);
    } finally {
      invalidateUserRobotsCache(ctx.identity.userId);
    }

    // Reload whatever happened: committed steps change the facts the next robot is planned on.
    current = await loadStableFacts(prisma, current.profileId, reloadOptions(current, ctx.blueprints));
    const after = current.robots.find((r) => r.robotId === robotId);
    if (after && isLoadoutReady(after)) {
      logger.warn(`${label}: robot ${robotId} (slot ${robot.slotIndex}) fit-out resumed; battle-ready again`);
      resumed.push(robotId);
    } else {
      logger.error(`${label}: robot ${robotId} (slot ${robot.slotIndex}) is still not battle-ready after fit-out recovery`);
      unresolved.push(robotId);
    }
  }

  return { facts: current, resumed, unresolved };
}
