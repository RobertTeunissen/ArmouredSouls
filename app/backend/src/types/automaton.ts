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

/** The six Build_Focus presets (approved values in review/STRATEGIES.md §3). */
export type BuildFocusKey = 'bruiser' | 'deadeye' | 'warden' | 'sprinter' | 'tactician' | 'versatile';

/** Attribute_Groups a Build_Focus weights; `ai` covers AI Processing and Team Coordination. */
export type AttributeGroup = 'combat' | 'defense' | 'mobility' | 'ai';

/** One Weapon_Stage of a Robot_Blueprint's Weapon_Path (stored in `weapon_path`). */
export interface WeaponStage {
  /** Catalogue weapon name. */
  main: string;
  /** Off-hand weapon for `dual_wield` (may differ from main), shield for `weapon_shield`. */
  offhand?: string;
}

/** One step of a Refinement_Plan (stored in `refinement_plan`). */
export interface RefinementStep {
  tier: RefinementTier;
  hand: 'main' | 'offhand';
  /** Hone and augment only. */
  targetAttribute?: RobotAttribute;
  /** 1 for sharpen / forge. */
  magnitude: number;
}

/**
 * Stored in `AutomatonProfile.teamNames`. Index i names the i-th Team_Rule
 * team of that size.
 */
export interface TeamNames {
  /** At most 5: slots 1+2, 3+4, 5+6, 7+8, 9+10. */
  twoVsTwo: string[];
  /** At most 3: slots 1–3, 4–6, 7–9. */
  threeVsThree: string[];
}

/** Stored in `AutomatonProfile.eventOrder`: all 9 subscribable event types, each once, in order of preference. */
export type EventOrder = SubscribableEventType[];

/** Stored in `AutomatonProfile.strategyParameters`. Keys are Goal ids of the profile's Build_Order. */
export interface StrategyParametersV1 {
  /** Goal id → Goal_Target (robot count, facility level, attribute level, stage index, refine step count 0–10). */
  targets: Record<string, number>;
}
