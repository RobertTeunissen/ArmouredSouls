/**
 * Execution primitives shared by `actionExecutor.ts` and `robotFitout.ts`
 * (Spec #55, R7.7, R8.1, R8.2, R8.7, design §9.3, §9.4, §10).
 *
 * Every charged step goes through the domain service the player route uses
 * (facility upgrade, weapon purchase, weapon sale, weapon refinement; robot
 * creation and attribute upgrades live with their callers), in its own
 * transaction, with:
 * - a deterministic request key (`buildAutomatonRequestKey`; the ordinal is
 *   the step's 1-based position among the attempt's charged steps), so a
 *   replay of a committed step is a no-op;
 * - the Automaton audit context (design §9.4), stored on the Financial_Pair;
 * - after a non-replayed step, the achievement check the route makes, with
 *   the routes' "failures don't block" wrapper.
 *
 * Domain-service errors are not caught here: the domain service is the
 * authority (R5.3, R8.7), the rest of the action is abandoned and the turn
 * records the error (design §8.5). Steps already committed stay in the
 * cursor, so the turn can record them.
 *
 * Balances are only ever read from service results; nothing here writes the
 * stable's balance (R8.3).
 */
import { z } from 'zod';
import { upgradeFacility } from '../economy/facilityUpgradeService';
import { purchaseWeapon } from '../economy/weaponPurchaseService';
import { sellWeapon } from '../economy/weaponSaleService';
import {
  equipMainWeapon,
  equipOffhandWeapon,
  unequipMainWeapon,
  unequipOffhandWeapon,
  changeLoadoutType,
} from '../robot/robotWeaponService';
import prisma from '../../lib/prisma';
import type { AutomatonTurnTrigger } from '../../../generated/prisma';
import type { EconomicServiceOptions } from '../financial/economicRequestReplayService';
import { awardQuietly } from './upkeep/freeUpkeep';
import { buildAutomatonRequestKey } from './requestKeys';
import { weaponByName } from './goals/goalSupport';
import type { BuildFocusWeightTable } from './buildFocus';
import type { BlueprintFacts, FacilityType, Hand, LoadoutType, WeaponFacts } from './stableFacts';
import type { EventOrder, TeamNames } from '../../types/automaton';

/** Identity of the Automaton_Turn attempt the actions belong to. */
export interface AutomatonTurnIdentity {
  profileId: number;
  userId: number;
  catalogueKey: string;
  strategyKey: string;
  strategyVersion: number;
  seasonNumber: number;
  trigger: AutomatonTurnTrigger;
  /** Turn_Slot. */
  slot: number;
  /** Turn_Record attempt, 1-based. */
  attempt: number;
}

export interface ExecutionContext {
  identity: AutomatonTurnIdentity;
  /** Ordered by slot. */
  blueprints: readonly BlueprintFacts[];
  /** Weapon catalogue keyed by name (loaded once per Turn_Step). */
  weapons: ReadonlyMap<string, WeaponFacts>;
  teamNames: TeamNames;
  eventOrder: EventOrder;
  /** Build_Focus weight table for the fit-out's tuning; the approved presets by default. */
  weightTable?: BuildFocusWeightTable;
}

/** The six charged operations (R8.1), named as their Credit_Mutation_Service transaction types. */
export type ChargedStepKind =
  | 'robot_creation'
  | 'attribute_upgrade'
  | 'facility_upgrade'
  | 'weapon_purchase'
  | 'weapon_sale'
  | 'weapon_refinement';

export interface ExecutedChargedStep {
  /** 1-based position among the attempt's charged steps. */
  ordinal: number;
  requestKey: string;
  kind: ChargedStepKind;
  goalId: string;
  /** Credits this call charged (0 for a sale or a replay). */
  spent: number;
  /** Credits this call paid out (sale proceeds; 0 otherwise or on replay). */
  received: number;
  /** True when the domain service answered from a committed request (no credits moved). */
  replayed: boolean;
  detail: Record<string, string | number>;
}

/**
 * Charged steps of one attempt, in order. Shared by every action of the
 * attempt so ordinals (and request keys) keep counting across actions.
 */
export interface ExecutionCursor {
  chargedSteps: number;
  creditsSpent: number;
  creditsReceived: number;
  steps: ExecutedChargedStep[];
}

export function createExecutionCursor(): ExecutionCursor {
  return { chargedSteps: 0, creditsSpent: 0, creditsReceived: 0, steps: [] };
}

export interface ChargedStepIdentity {
  ordinal: number;
  requestKey: string;
  options: EconomicServiceOptions;
}

/** Request key and audit context of the cursor's next charged step. */
export function nextChargedStep(ctx: ExecutionContext, cursor: ExecutionCursor, goalId: string): ChargedStepIdentity {
  const { identity } = ctx;
  const ordinal = cursor.chargedSteps + 1;
  const requestKey = buildAutomatonRequestKey({
    profileId: identity.profileId,
    seasonNumber: identity.seasonNumber,
    trigger: identity.trigger,
    slot: identity.slot,
    attempt: identity.attempt,
    ordinal,
  });
  return {
    ordinal,
    requestKey,
    options: {
      auditContext: {
        automaton: {
          catalogueKey: identity.catalogueKey,
          strategyKey: identity.strategyKey,
          strategyVersion: identity.strategyVersion,
          trigger: identity.trigger,
          slot: identity.slot,
          attempt: identity.attempt,
          goalId,
        },
      },
    },
  };
}

/** Record a committed charged step on the cursor. */
export function recordChargedStep(
  cursor: ExecutionCursor,
  step: ChargedStepIdentity,
  entry: Omit<ExecutedChargedStep, 'ordinal' | 'requestKey'>,
): void {
  cursor.chargedSteps = step.ordinal;
  cursor.creditsSpent += entry.spent;
  cursor.creditsReceived += entry.received;
  cursor.steps.push({ ordinal: step.ordinal, requestKey: step.requestKey, ...entry });
}

const idShape = z.object({ id: z.number().int().positive() });

/** The `id` of a stored replay payload (robot or inventory row). */
export function idOfStored(value: unknown, label: string): number {
  const parsed = idShape.safeParse(value);
  if (!parsed.success) throw new Error(`Replayed ${label} has no id`);
  return parsed.data.id;
}

// ─── Charged primitives ──────────────────────────────────────────────

/** Buy `facilityType` level `toLevel` through `facilityUpgradeService`. */
export async function buyFacilityLevel(
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  goalId: string,
  facilityType: FacilityType,
  toLevel: number,
): Promise<void> {
  const { userId } = ctx.identity;
  const step = nextChargedStep(ctx, cursor, goalId);
  const result = await upgradeFacility(userId, facilityType, step.requestKey, step.options);
  const detail = { facilityType, toLevel };
  if (result.replayed) {
    recordChargedStep(cursor, step, { kind: 'facility_upgrade', goalId, spent: 0, received: 0, replayed: true, detail });
    return;
  }
  recordChargedStep(cursor, step, { kind: 'facility_upgrade', goalId, spent: result.cost, received: 0, replayed: false, detail });
  await awardQuietly(userId, null, { type: 'facility_upgraded', data: { facilityType, newLevel: result.newLevel } });
}

/** Buy one copy of `weaponName` through `weaponPurchaseService`; returns the new inventory id. */
export async function buyWeapon(
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  goalId: string,
  weaponName: string,
): Promise<number> {
  const { userId } = ctx.identity;
  const weapon = weaponByName(ctx, weaponName);
  const step = nextChargedStep(ctx, cursor, goalId);
  const result = await purchaseWeapon(userId, weapon.weaponId, step.requestKey, step.options);
  if (result.replayed) {
    const inventoryId = idOfStored(result.response.weaponInventory, 'weapon inventory row');
    recordChargedStep(cursor, step, {
      kind: 'weapon_purchase', goalId, spent: 0, received: 0, replayed: true, detail: { weaponName, inventoryId },
    });
    return inventoryId;
  }
  const inventoryId = result.weaponInventory.id;
  recordChargedStep(cursor, step, {
    kind: 'weapon_purchase', goalId, spent: result.finalCost, received: 0, replayed: false, detail: { weaponName, inventoryId },
  });
  await awardQuietly(userId, null, {
    type: 'weapon_purchased',
    data: { weaponId: weapon.weaponId, weaponType: result.weapon.weaponType, weaponName: result.weapon.name },
  });
  return inventoryId;
}

/** Sell unequipped inventory item `inventoryId` through `weaponSaleService` (Storage_Overflow_Rule). */
export async function sellInventoryItem(
  ctx: ExecutionContext,
  cursor: ExecutionCursor,
  goalId: string,
  inventoryId: number,
): Promise<void> {
  const { userId } = ctx.identity;
  const step = nextChargedStep(ctx, cursor, goalId);
  const result = await sellWeapon(userId, inventoryId, step.requestKey, step.options);
  if (result.replayed) {
    recordChargedStep(cursor, step, {
      kind: 'weapon_sale', goalId, spent: 0, received: 0, replayed: true,
      detail: { inventoryId, weaponName: result.response.weaponName },
    });
    return;
  }
  recordChargedStep(cursor, step, {
    kind: 'weapon_sale', goalId, spent: 0, received: result.salePrice, replayed: false,
    detail: { inventoryId, weaponName: result.weaponName },
  });
  await awardQuietly(userId, null, {
    type: 'weapon_sold',
    data: {
      weaponId: result.weaponId,
      salePrice: result.salePrice,
      pricePaid: result.pricePaid,
      workshopLevel: result.workshopLevel,
    },
  });
}

// ─── Free primitives ─────────────────────────────────────────────────

interface RobotHands {
  loadoutType: string;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
}

async function robotHands(robotId: number): Promise<RobotHands> {
  return prisma.robot.findUniqueOrThrow({
    where: { id: robotId },
    select: { loadoutType: true, mainWeaponId: true, offhandWeaponId: true },
  });
}

/** Equip `inventoryId` in `hand` (skipped when the hand already holds it, e.g. on a replay). */
export async function equipHand(ctx: ExecutionContext, robotId: number, hand: Hand, inventoryId: number): Promise<void> {
  const { userId } = ctx.identity;
  const current = await robotHands(robotId);
  const held = hand === 'main' ? current.mainWeaponId : current.offhandWeaponId;
  if (held === inventoryId) return;
  if (hand === 'main') await equipMainWeapon(userId, robotId, inventoryId);
  else await equipOffhandWeapon(userId, robotId, inventoryId);
  await awardQuietly(userId, robotId, { type: 'weapon_equipped', data: { robotId, slot: hand } });
}

/** Empty `hand` (skipped when it is already empty). */
export async function unequipHand(ctx: ExecutionContext, robotId: number, hand: Hand): Promise<void> {
  const { userId } = ctx.identity;
  const current = await robotHands(robotId);
  const held = hand === 'main' ? current.mainWeaponId : current.offhandWeaponId;
  if (held === null) return;
  if (hand === 'main') await unequipMainWeapon(userId, robotId);
  else await unequipOffhandWeapon(userId, robotId);
}

/** Change the loadout through `changeLoadoutType` (skipped when it already matches). */
export async function setLoadout(ctx: ExecutionContext, robotId: number, loadoutType: LoadoutType): Promise<void> {
  const current = await robotHands(robotId);
  if (current.loadoutType === loadoutType) return;
  await changeLoadoutType(ctx.identity.userId, robotId, loadoutType);
}
