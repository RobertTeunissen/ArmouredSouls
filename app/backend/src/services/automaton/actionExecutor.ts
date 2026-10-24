/**
 * Action executor (Spec #55, R5.4, R7.7, R8.1, R8.2, R8.4, R8.7, design §8.3,
 * §8.5, §8.6, §9.3, §9.4, task 5.2).
 *
 * Executes one PlannedAction from the planner: every charged step through
 * the domain service of the equivalent player route, in its own transaction,
 * with a deterministic request key and the Automaton audit context; the
 * route's achievement check after each step; then the stable's facts are
 * reloaded so the planner restarts from the truth (R5.1).
 *
 * The executor never decides whether an action is allowed. A planner defect
 * (an unaffordable, gated or otherwise invalid step) is rejected by the
 * domain service with no state change for that step; the error propagates,
 * the remaining steps are abandoned, and committed steps stay recorded on the
 * cursor (design §8.5). The Turn_Budget is the turn runner's concern: it
 * checks `checkTurnBudget(state, now, chargedStepCount(action))` before
 * calling `executeAction`, so an action never straddles the 60-action limit.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { executeUpgradeTransaction, type UpgradeRequest } from '../robot/robotUpgradeService';
import { refineWeapon } from '../economy/weaponRefinementService';
import { invalidateUserRobotsCache } from '../robot/robotQueryService';
import { eventLogger } from '../common/eventLogger';
import { trackSpending } from '../economy/spendingTracker';
import type { RobotAttribute } from '../../shared/utils/robotAttributes';
import {
  buyFacilityLevel,
  buyWeapon,
  equipHand,
  nextChargedStep,
  recordChargedStep,
  sellInventoryItem,
  setLoadout,
  unequipHand,
  type ExecutionContext,
  type ExecutionCursor,
} from './executionSteps';
import { executeRobotChain } from './robotFitout';
import { awardQuietly, type FreeUpkeepIssue } from './upkeep/freeUpkeep';
import { loadStableFacts, reloadOptions, type Hand, type RobotFacts, type StableFacts } from './stableFacts';
import type { PlannedAction } from './goals/goalTypes';

export {
  createExecutionCursor,
  type AutomatonTurnIdentity,
  type ChargedStepKind,
  type ExecutedChargedStep,
  type ExecutionContext,
  type ExecutionCursor,
} from './executionSteps';

export interface ActionExecution {
  /** Facts reloaded after the action (R5.1). */
  facts: StableFacts;
  /** Free_Upkeep issues raised by a Robot_Fitout (team or subscription parts). */
  upkeepIssues: FreeUpkeepIssue[];
}

function robotInSlot(facts: StableFacts, slotIndex: number): RobotFacts {
  const robot = facts.robots.find((r) => r.slotIndex === slotIndex);
  if (!robot) throw new Error(`No live robot in Blueprint_Slot ${slotIndex}`);
  return robot;
}

async function executeAttributeUpgrade(
  action: Extract<PlannedAction, { kind: 'attribute_upgrade' }>,
  goalId: string,
  facts: StableFacts,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
): Promise<void> {
  const { userId } = ctx.identity;
  const robot = robotInSlot(facts, action.robotSlot);
  const upgrades: Record<string, UpgradeRequest> = {};
  for (const [attribute, levels] of Object.entries(action.increments) as [RobotAttribute, number][]) {
    const currentLevel = Math.floor(robot.attributes[attribute]);
    upgrades[attribute] = { currentLevel, plannedLevel: currentLevel + levels };
  }
  const step = nextChargedStep(ctx, cursor, goalId);
  const result = await executeUpgradeTransaction(userId, robot.robotId, upgrades, step.requestKey, step.options);
  const detail = { robotId: robot.robotId, attributes: Object.keys(upgrades).length };
  if (result.replayed) {
    recordChargedStep(cursor, step, { kind: 'attribute_upgrade', goalId, spent: 0, received: 0, replayed: true, detail });
    return;
  }
  recordChargedStep(cursor, step, { kind: 'attribute_upgrade', goalId, spent: result.totalCost, received: 0, replayed: false, detail });

  // The logging and achievement check `POST /api/robots/:id/upgrades` makes.
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;
    await trackSpending(userId, 'attributes', result.totalCost);
    for (const op of result.upgradeOperations) {
      await eventLogger.logAttributeUpgrade(currentCycle, robot.robotId, op.attribute, op.fromLevel, op.toLevel, op.cost, userId);
    }
  } catch (logError) {
    logger.error('[Automaton] Failed to log attribute upgrades:', logError);
  }
  await awardQuietly(userId, robot.robotId, {
    type: 'attribute_upgraded',
    data: { robotId: robot.robotId, upgrades: result.upgradeOperations },
  });
}

async function executeWeaponStage(
  action: Extract<PlannedAction, { kind: 'weapon_stage' }>,
  goalId: string,
  facts: StableFacts,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
): Promise<void> {
  const robot = robotInSlot(facts, action.robotSlot);
  const purchased = new Map<Hand, number>();
  for (const step of action.steps) {
    switch (step.kind) {
      case 'facility_upgrade':
        await buyFacilityLevel(ctx, cursor, goalId, step.facilityType, step.toLevel);
        break;
      case 'weapon_sale':
        await sellInventoryItem(ctx, cursor, goalId, step.inventoryId);
        break;
      case 'weapon_purchase':
        purchased.set(step.hand, await buyWeapon(ctx, cursor, goalId, step.weaponName));
        break;
      case 'unequip':
        await unequipHand(ctx, robot.robotId, step.hand);
        break;
      case 'loadout_change':
        await setLoadout(ctx, robot.robotId, step.loadoutType);
        break;
      case 'equip': {
        const inventoryId = step.source.kind === 'inventory' ? step.source.inventoryId : purchased.get(step.hand);
        if (inventoryId === undefined) throw new Error(`Stage step for slot ${action.robotSlot}: no purchase for the ${step.hand} hand`);
        await equipHand(ctx, robot.robotId, step.hand, inventoryId);
        break;
      }
    }
  }
  invalidateUserRobotsCache(ctx.identity.userId);
}

async function executeRefinement(
  action: Extract<PlannedAction, { kind: 'weapon_refinement' }>,
  goalId: string,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
): Promise<void> {
  const { userId } = ctx.identity;
  for (const level of action.chain) {
    await buyFacilityLevel(ctx, cursor, goalId, level.facilityType, level.toLevel);
  }
  const { tier, targetAttribute, magnitude } = action.step;
  const step = nextChargedStep(ctx, cursor, goalId);
  const result = await refineWeapon(userId, action.inventoryId, { tier, targetAttribute, magnitude }, step.requestKey, step.options);
  const detail: Record<string, string | number> = { inventoryId: action.inventoryId, tier, hand: action.step.hand };
  if (targetAttribute !== undefined) detail.targetAttribute = targetAttribute;
  if (result.replayed) {
    recordChargedStep(cursor, step, { kind: 'weapon_refinement', goalId, spent: 0, received: 0, replayed: true, detail });
    return;
  }
  recordChargedStep(cursor, step, { kind: 'weapon_refinement', goalId, spent: result.cost, received: 0, replayed: false, detail });
  await awardQuietly(userId, null, {
    type: 'weapon_refined',
    data: {
      weaponInventoryId: result.weaponInventory.id,
      weaponId: result.weapon.id,
      tier,
      magnitude: result.magnitude,
      targetAttribute: targetAttribute ?? null,
      costPaid: result.cost,
      refinementLabLevel: result.refinementLabLevel,
    },
  });
}

/**
 * Execute one PlannedAction (design §8.3 step "execute") and reload the facts.
 * `facts` must be the facts the action was planned on.
 */
export async function executeAction(
  action: PlannedAction,
  goalId: string,
  facts: StableFacts,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
): Promise<ActionExecution> {
  let upkeepIssues: FreeUpkeepIssue[] = [];
  switch (action.kind) {
    case 'facility_upgrade':
      await buyFacilityLevel(ctx, cursor, goalId, action.facilityType, action.toLevel);
      break;
    case 'attribute_upgrade':
      await executeAttributeUpgrade(action, goalId, facts, ctx, cursor);
      break;
    case 'robot_chain':
      upkeepIssues = (await executeRobotChain(action, goalId, facts, ctx, cursor)).upkeepIssues;
      break;
    case 'weapon_stage':
      await executeWeaponStage(action, goalId, facts, ctx, cursor);
      break;
    case 'weapon_refinement':
      await executeRefinement(action, goalId, ctx, cursor);
      break;
  }
  const reloaded = await loadStableFacts(prisma, facts.profileId, reloadOptions(facts, ctx.blueprints));
  return { facts: reloaded, upkeepIssues };
}
