/**
 * Goal contracts of the Goal_Library (Spec #55, design §8.2).
 *
 * A Goal evaluates pure stable facts and returns one Goal_Outcome. An
 * Actionable outcome carries exactly one PlannedAction, priced with
 * `pricing.ts`; the planner executes it, reloads facts and restarts at the
 * first Goal (R5.1).
 *
 * Additions to the design-level shapes (needed by the executor; no change in
 * meaning): the `fitout` chain step carries the starting stage, the reused
 * inventory items and the purchases; stage steps add `unequip` and
 * `loadout_change` so a loadout change never meets an incompatible equipped
 * weapon (`changeLoadoutType` refuses that); `weapon_refinement` names the
 * inventory item and carries the Weapons Workshop levels of its Goal_Chain.
 */
import type { StrategyParametersV1 } from '../../../types/automaton';
import type { RefinementStep } from '../../../types/automaton';
import type { BlueprintFacts, FacilityType, Hand, LoadoutType, StableFacts, WeaponFacts } from '../stableFacts';
import type { RobotAttribute } from '../../../shared/utils/robotAttributes';

export type BlockedReason =
  | 'prestige_gate'
  | 'max_level'
  | 'roster_limit'
  | 'no_blueprint'
  | 'awaiting_final_weapon'
  | 'storage_limit'
  | 'name_unavailable';

export type GoalDetail = Record<string, number | string>;

/** A facility level bought as part of a Goal_Chain or as a facility Goal. */
export interface FacilityLevelStep {
  kind: 'facility_upgrade';
  facilityType: FacilityType;
  toLevel: number;
  cost: number;
}

/** Storage_Overflow_Rule sale; proceeds are never subtracted from a chain's cost. */
export interface WeaponSaleStep {
  kind: 'weapon_sale';
  inventoryId: number;
  proceeds: number;
}

export interface WeaponPurchasePart {
  weaponName: string;
  hand: Hand;
  cost: number;
}

/** Which item a hand is equipped with: an existing inventory item or the purchase for that hand. */
export type EquipSource = { kind: 'inventory'; inventoryId: number } | { kind: 'purchase' };

export type ChainStep =
  | WeaponSaleStep
  | (FacilityLevelStep & { facilityType: 'roster_expansion' | 'storage_facility' })
  | { kind: 'robot_purchase'; robotName: string; cost: number }
  | {
    kind: 'fitout';
    /** Starting Weapon_Stage (the highest one Weapon_Reuse fills for every hand, else 0). */
    stageIndex: number;
    loadoutType: LoadoutType;
    equip: { hand: Hand; weaponName: string; source: EquipSource }[];
    purchases: WeaponPurchasePart[];
  };

export type StageStep =
  | (FacilityLevelStep & { facilityType: 'storage_facility' })
  | WeaponSaleStep
  | ({ kind: 'weapon_purchase' } & WeaponPurchasePart)
  | { kind: 'unequip'; hand: Hand }
  | { kind: 'loadout_change'; loadoutType: LoadoutType }
  | { kind: 'equip'; hand: Hand; weaponName: string; source: EquipSource };

export type PlannedAction =
  | { kind: 'robot_chain'; slotIndex: number; steps: ChainStep[] }
  | FacilityLevelStep
  | {
    kind: 'attribute_upgrade';
    robotSlot: number;
    /** Levels to add per attribute (each attribute rises by this many whole levels). */
    increments: Partial<Record<RobotAttribute, number>>;
    cost: number;
  }
  | { kind: 'weapon_stage'; robotSlot: number; toStage: number; steps: StageStep[] }
  | {
    kind: 'weapon_refinement';
    robotSlot: number;
    inventoryId: number;
    step: RefinementStep;
    /** Weapons Workshop levels the step's tier needs, bought first (Goal_Chain, R5.4). */
    chain: FacilityLevelStep[];
    /** Refinement price alone (the outcome's cost adds the chain). */
    refinementCost: number;
  };

export type GoalOutcome =
  | { kind: 'satisfied'; goalId: string }
  | { kind: 'blocked'; goalId: string; reason: BlockedReason; detail: GoalDetail }
  | { kind: 'saving'; goalId: string; cost: number; detail: GoalDetail }
  | { kind: 'actionable'; goalId: string; action: PlannedAction; cost: number };

export interface GoalContext {
  /** This Goal's Goal_Target from `params.targets[goal.id]` (or the strategy default). */
  target: number;
  params: StrategyParametersV1;
  /** Ordered by slot. */
  blueprints: readonly BlueprintFacts[];
  /** Weapon catalogue keyed by name. */
  weapons: ReadonlyMap<string, WeaponFacts>;
  /** `facts.balance`: the only affordability input. */
  balance: number;
}

export interface Goal {
  /** Stable within a Strategy_Version, e.g. `swarm.v1.10.robots`. */
  id: string;
  evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome;
}

/** Saving when the step costs more than the balance, otherwise Actionable (R5.3: `balance ≥ cost`). */
export function savingOrActionable(
  goalId: string,
  action: PlannedAction,
  cost: number,
  balance: number,
  detail: GoalDetail = {},
): GoalOutcome {
  if (cost > balance) {
    return { kind: 'saving', goalId, cost, detail: { ...detail, actionKind: action.kind } };
  }
  return { kind: 'actionable', goalId, action, cost };
}
