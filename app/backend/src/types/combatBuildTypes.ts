/**
 * Battle-time build of one robot in one fought battle, stored in
 * `battle_participant_builds` (see `services/battle/combatBuildRecorder.ts`).
 * Feeds the admin Attributes and Weapons analyses ("what wins").
 */

/** Attribute name (`ROBOT_ATTRIBUTES`) → value. */
export type AttributeValues = Record<string, number>;

/** One refinement on a weapon at battle time. */
export interface StoredRefinement {
  tier: string;
  magnitude: number;
  targetAttribute: string | null;
}

/** An equipped weapon at battle time: catalogue id plus its refinements. */
export interface CombatWeaponSnapshot {
  /** `weapons.id` (catalogue). */
  weaponId: number;
  refinements: StoredRefinement[];
}

export interface CombatBuildSnapshot {
  /** Attribute levels bought by the stable, before weapons, tuning and loadout. */
  baseAttributes: AttributeValues;
  /** Tuning bonus per attribute (sparse). */
  tuning: AttributeValues;
  /** The values the simulator fought with: round2((base + weapon bonuses + tuning) × (1 + loadout)). */
  effectiveAttributes: AttributeValues;
  mainWeapon: CombatWeaponSnapshot | null;
  offhandWeapon: CombatWeaponSnapshot | null;
  /** Loadout the robot fought with (after any battle-time fallback). */
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
}
