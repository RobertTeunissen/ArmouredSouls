/**
 * Stored JSON shapes for Automaton Stables (Spec #55, design §6.2).
 *
 * These describe the Prisma `Json` columns on `AutomatonProfile` and
 * `AutomatonRobotBlueprint`. Reads cast with `as unknown as SpecificType`
 * only after Zod validation (coding-standards.md).
 */
import type { RefinementTier } from '../shared/utils/weaponRefinement';
import type { RobotAttribute } from '../shared/utils/robotAttributes';
import type { SubscribableEventType } from '../services/subscription/eventRegistry';
import type { AcademyGroup } from '../shared/types';

/** Stored in `AutomatonProfile.eventOrder`: all 9 subscribable event types, each once, in order of preference. */
export type EventOrder = SubscribableEventType[];

/** One charged step of an Automaton_Turn (stored in `AutomatonTurn.actions`, in order). */
export interface TurnActionRecord {
  /** 1-based position among the attempt's charged steps (the request-key ordinal). */
  ordinal: number;
  requestKey: string;
  /** Credit_Mutation_Service transaction type: robot_creation, attribute_upgrade, facility_upgrade, weapon_purchase, weapon_sale, weapon_refinement. */
  kind: string;
  goalId: string;
  spent: number;
  received: number;
  replayed: boolean;
  detail: Record<string, string | number>;
}

/** Outcome of one Goal in the turn's final evaluation (stored in `AutomatonTurn.goalOutcomes`, Build_Order order). */
export type TurnGoalOutcome =
  | { goalId: string; kind: 'satisfied' }
  | { goalId: string; kind: 'blocked'; reason: string; detail: Record<string, number | string> }
  | { goalId: string; kind: 'saving'; cost: number; detail: Record<string, number | string> }
  | { goalId: string; kind: 'actionable'; cost: number; actionKind: string };

/** A Free_Upkeep part that could not be applied (stored in `AutomatonTurn.upkeepIssues`). */
export interface TurnUpkeepIssue {
  part: string;
  code: string;
  message: string;
  robotId?: number;
  teamSize?: 2 | 3;
  teamIndex?: number;
}

/** A Catalogue_Entry skipped by Catalogue_Sync because its stable name is taken (R10.4). */
export interface CatalogueSyncConflict {
  catalogueKey: string;
  stableName: string;
  reason: 'stable_name_taken';
}

/** A Repository_Image filled onto a Robot_Blueprint that had no image (R10.3). */
export interface CatalogueImageFill {
  catalogueKey: string;
  slot: number;
  imageUrl: string;
}

/** Stored in `AutomatonProfile.strategyParameters`. Keys are Goal ids of the profile's Build_Order. */
export interface StrategyParametersV1 {
  /** Goal id → Goal_Target (robot count, facility level, attribute level, stage index, refine step count 0–10). */
  targets: Record<string, number>;
}
