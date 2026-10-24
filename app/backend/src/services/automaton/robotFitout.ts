/**
 * Robot_Chain execution and Robot_Fitout (Spec #55, R3.9, R3.10, R5.4,
 * R14.3, design §8.5, §9.1, task 5.3).
 *
 * Runs the chain steps in order — Storage_Overflow_Rule sales, Roster
 * Expansion and Storage Facility levels, the robot, its fit-out — each charged
 * step in its own transaction (R7.7). The fit-out follows design §9.1:
 * 1. `createRobotTransaction` (₡500,000; no standings rows, those come with
 *    the robot's first subscription in step 6);
 * 2. link the robot to its Robot_Blueprint and Blueprint_Slot and copy the
 *    blueprint image (a direct column write; not a balance write);
 * 3. `changeLoadoutType` to the blueprint loadout;
 * 4. stance and yield through `robotSettingsService`;
 * 5. the starting Weapon_Stage: purchases, then equip main, then off hand;
 * 6. Free_Upkeep's team and subscription parts for the stable;
 * 7. the robot's tuning allocation.
 * So the robot is armed, configured, subscribed and teamed before the turn
 * ends. Steps 1 and 2 are one transaction: `createRobotTransaction` writes
 * the blueprint link with the robot (`automatonLink`), so an Automaton robot
 * never exists without it (invariant I4).
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { createRobotTransaction, validateRobotName, ROBOT_CREATION_COST } from '../robot/robotCreationService';
import { updateStance, updateYieldThreshold } from '../robot/robotSettingsService';
import { invalidateUserRobotsCache } from '../robot/robotQueryService';
import { findCompletedEconomicRequest } from '../financial/economicRequestReplayService';
import { eventLogger } from '../common/eventLogger';
import { trackSpending } from '../economy/spendingTracker';
import {
  buyFacilityLevel,
  buyWeapon,
  equipHand,
  idOfStored,
  nextChargedStep,
  recordChargedStep,
  sellInventoryItem,
  setLoadout,
  type ExecutionContext,
  type ExecutionCursor,
} from './executionSteps';
import { awardQuietly, runFreeUpkeep, type FreeUpkeepIssue } from './upkeep/freeUpkeep';
import { blueprintForSlot, loadStableFacts, reloadOptions, type BlueprintFacts, type Hand, type StableFacts } from './stableFacts';
import type { ChainStep, PlannedAction } from './goals/goalTypes';

type RobotChainAction = Extract<PlannedAction, { kind: 'robot_chain' }>;
type FitoutStep = Extract<ChainStep, { kind: 'fitout' }>;

export interface RobotChainResult {
  robotId: number | null;
  upkeepIssues: FreeUpkeepIssue[];
}

/** Robot purchase (fit-out steps 1–2). Returns the robot id. */
async function purchaseRobot(
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  goalId: string,
  blueprint: BlueprintFacts,
  robotName: string,
): Promise<number> {
  const { userId } = ctx.identity;
  const step = nextChargedStep(ctx, cursor, goalId);
  // As `POST /api/robots`: a committed request answers before the name check,
  // which would otherwise reject the robot's own name.
  const replay = await findCompletedEconomicRequest<{ robot: unknown }>(userId, 'robot_creation', step.requestKey, { name: robotName });
  // Step 2: blueprint link, Blueprint_Slot and image (R3.10; null = no image).
  const link = { blueprintId: blueprint.blueprintId, slotIndex: blueprint.slotIndex, imageUrl: blueprint.imageUrl };
  if (replay) {
    const robotId = idOfStored(replay.response.robot, 'robot');
    recordChargedStep(cursor, step, { kind: 'robot_creation', goalId, spent: 0, received: 0, replayed: true, detail: { robotName, robotId } });
    return robotId;
  }
  const name = await validateRobotName(robotName);
  const balanceBefore = (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true } })).currency;
  // The link is written by the creating transaction itself (invariant I4).
  const result = await createRobotTransaction(userId, name, step.requestKey, { ...step.options, automatonLink: link });
  const robotId = idOfStored(result.robot, 'robot');
  recordChargedStep(cursor, step, {
    kind: 'robot_creation', goalId, spent: result.replayed ? 0 : ROBOT_CREATION_COST, received: 0, replayed: result.replayed,
    detail: { robotName: name, robotId },
  });
  if (!result.replayed) await afterRobotCreated(userId, robotId, name, balanceBefore, result.user.currency);
  return robotId;
}

/** The logging and achievement check `POST /api/robots` makes after a creation. */
async function afterRobotCreated(userId: number, robotId: number, name: string, balanceBefore: number, balanceAfter: number): Promise<void> {
  try {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;
    await eventLogger.logRobotPurchase(currentCycle, userId, robotId, name, ROBOT_CREATION_COST, balanceBefore, balanceAfter);
    logger.info(`[Automaton] User ${userId} | Created: "${name}" | Cost: ₡${ROBOT_CREATION_COST.toLocaleString()} | Balance: ₡${balanceBefore.toLocaleString()} → ₡${balanceAfter.toLocaleString()}`);
    await trackSpending(userId, 'robots', ROBOT_CREATION_COST);
  } catch (logError) {
    logger.error('[Automaton] Failed to log robot creation event:', logError);
  }
  await awardQuietly(userId, robotId, { type: 'robot_created', data: { robotId, robotName: name } });
}

/** Fit-out steps 3–7 for the robot just bought. */
async function fitRobot(
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  goalId: string,
  facts: StableFacts,
  blueprint: BlueprintFacts,
  robotId: number,
  step: FitoutStep,
): Promise<FreeUpkeepIssue[]> {
  const { userId } = ctx.identity;

  await setLoadout(ctx, robotId, step.loadoutType);

  const settings = await prisma.robot.findUniqueOrThrow({ where: { id: robotId }, select: { stance: true, yieldThreshold: true } });
  if (settings.stance !== blueprint.stance) {
    const result = await updateStance(userId, robotId, blueprint.stance);
    await awardQuietly(userId, robotId, { type: 'stance_changed', data: { robotId, stance: result.stance } });
  }
  if (settings.yieldThreshold !== blueprint.yieldThreshold) {
    await updateYieldThreshold(userId, robotId, blueprint.yieldThreshold);
  }

  const purchased = new Map<Hand, number>();
  for (const purchase of step.purchases) {
    purchased.set(purchase.hand, await buyWeapon(ctx, cursor, goalId, purchase.weaponName));
  }
  for (const equip of step.equip) {
    const inventoryId = equip.source.kind === 'inventory' ? equip.source.inventoryId : purchased.get(equip.hand);
    if (inventoryId === undefined) throw new Error(`Fit-out of slot ${blueprint.slotIndex}: no purchase for the ${equip.hand} hand`);
    await equipHand(ctx, robotId, equip.hand, inventoryId);
  }

  const fitted = await loadStableFacts(prisma, facts.profileId, reloadOptions(facts, ctx.blueprints));
  const upkeep = await runFreeUpkeep(
    fitted,
    { userId, blueprints: ctx.blueprints, teamNames: ctx.teamNames, eventOrder: ctx.eventOrder, weightTable: ctx.weightTable },
    { parts: ['teams', 'subscriptions', 'tuning'], tuningRobotIds: [robotId] },
  );
  return upkeep.issues;
}

/** Execute a Robot_Chain (design §8.5) and the Robot_Fitout of its robot (design §9.1). */
export async function executeRobotChain(
  action: RobotChainAction,
  goalId: string,
  facts: StableFacts,
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
): Promise<RobotChainResult> {
  const blueprint = blueprintForSlot(ctx.blueprints, action.slotIndex);
  if (!blueprint) throw new Error(`No Robot_Blueprint for slot ${action.slotIndex}`);
  let robotId: number | null = null;
  const upkeepIssues: FreeUpkeepIssue[] = [];
  try {
    for (const step of action.steps) {
      switch (step.kind) {
        case 'weapon_sale':
          await sellInventoryItem(ctx, cursor, goalId, step.inventoryId);
          break;
        case 'facility_upgrade':
          await buyFacilityLevel(ctx, cursor, goalId, step.facilityType, step.toLevel);
          break;
        case 'robot_purchase':
          robotId = await purchaseRobot(ctx, cursor, goalId, blueprint, step.robotName);
          break;
        case 'fitout':
          if (robotId === null) throw new Error(`Fit-out of slot ${action.slotIndex} before its robot purchase`);
          upkeepIssues.push(...(await fitRobot(ctx, cursor, goalId, facts, blueprint, robotId, step)));
          break;
      }
    }
  } finally {
    if (robotId !== null) invalidateUserRobotsCache(ctx.identity.userId);
  }
  return { robotId, upkeepIssues };
}
