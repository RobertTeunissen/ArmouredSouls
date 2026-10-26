/**
 * Rebuild a robot's attribute values from its battle-time build record
 * (`battle_participant_builds`) with any combination of layers switched on.
 *
 * Combat computes (canonical formula, `shared/utils/robotStats.ts`):
 *   effective = round2((base + catalog weapon bonuses + Hone/Augment + tuning) × (1 + loadout))
 * and the simulator reads exactly those values (`prepareRobotForCombat`). With
 * every attribute layer on, the rebuilt values are the stored effective values.
 *
 * Stance is NOT an attribute layer: combat never changes attribute values by
 * stance. It applies stance inside its formulas (hit chance, damage, counter
 * chance, shield regen, movement speed), so the analysis models stance as its
 * own effect (see `analysisFeatures.ts`). `STANCE_MODIFIERS` in the shared
 * module is a display table and must not be used here.
 *
 * The record keeps base, tuning, effective and the refinements, but only the
 * weapon id, so the catalog bonus per attribute is derived from the stored
 * effective value. That stays right when the catalog changes mid-season.
 *
 * A season can hold hundreds of thousands of builds, so each is kept compact:
 * one Float32Array with the four additive layers, plus a loadout modifier
 * table shared by every build with the same loadout.
 */
import { ROBOT_ATTRIBUTES } from '../../../shared/utils/robotAttributes';
import { getLoadoutBonus } from '../../../shared/utils/robotStats';
import type { AttributeValues, StoredRefinement } from '../../../types/combatBuildTypes';
import type { LayerToggles } from './analysisOptions';

export const ATTRIBUTE_COUNT = ROBOT_ATTRIBUTES.length;

/** The stored record, as loaded. */
export interface RawBuild {
  baseAttributes: AttributeValues;
  tuning: AttributeValues;
  effectiveAttributes: AttributeValues;
  mainRefinements: StoredRefinement[] | null;
  offhandRefinements: StoredRefinement[] | null;
  loadoutType: string;
  stance: string;
}

/** Additive layers inside `LayeredBuild.data`, each `ATTRIBUTE_COUNT` long, in `ROBOT_ATTRIBUTES` order. */
export const LAYER_OFFSET = {
  base: 0,
  tuning: ATTRIBUTE_COUNT,
  /** Catalog weapon bonuses (both weapons), derived. */
  catalog: 2 * ATTRIBUTE_COUNT,
  /** Hone + Augment magnitudes (both weapons). */
  refinements: 3 * ATTRIBUTE_COUNT,
} as const;

export type AdditiveLayer = keyof typeof LAYER_OFFSET;

/** The stances combat distinguishes; anything else fights as balanced. */
export type CombatStance = 'offensive' | 'defensive' | 'balanced';

export interface LayeredBuild {
  data: Float32Array;
  /** `getLoadoutBonus` per attribute (shared table). */
  loadout: Float64Array;
  /** The stance the robot fought in (an effect of its own, not an attribute layer). */
  stance: CombatStance;
}

const loadoutTables = new Map<string, Float64Array>();

function loadoutTable(loadoutType: string): Float64Array {
  let values = loadoutTables.get(loadoutType);
  if (!values) {
    values = Float64Array.from(ROBOT_ATTRIBUTES, (attr) => getLoadoutBonus(loadoutType, attr));
    loadoutTables.set(loadoutType, values);
  }
  return values;
}

/** Combat checks `stance === 'offensive'` / `'defensive'`; every other value is balanced. */
export function combatStance(stance: string): CombatStance {
  return stance === 'offensive' || stance === 'defensive' ? stance : 'balanced';
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function num(values: AttributeValues | null | undefined, key: string): number {
  const value = values?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function refinementBonus(refinements: readonly StoredRefinement[] | null, attribute: string): number {
  let total = 0;
  for (const r of refinements ?? []) {
    if ((r.tier === 'hone' || r.tier === 'augment') && r.targetAttribute === attribute) total += Number(r.magnitude) || 0;
  }
  return total;
}

export function layerBuild(raw: RawBuild): LayeredBuild {
  const data = new Float32Array(4 * ATTRIBUTE_COUNT);
  const loadout = loadoutTable(raw.loadoutType);
  ROBOT_ATTRIBUTES.forEach((attr, k) => {
    const base = num(raw.baseAttributes, attr);
    const tuning = num(raw.tuning, attr);
    const refine = refinementBonus(raw.mainRefinements, attr) + refinementBonus(raw.offhandRefinements, attr);
    const stored = raw.effectiveAttributes?.[attr];
    const effective = typeof stored === 'number' && Number.isFinite(stored) ? stored : (base + tuning + refine) * (1 + loadout[k]);
    data[LAYER_OFFSET.base + k] = base;
    data[LAYER_OFFSET.tuning + k] = tuning;
    data[LAYER_OFFSET.catalog + k] = round2(effective / (1 + loadout[k]) - base - tuning - refine);
    data[LAYER_OFFSET.refinements + k] = refine;
  });
  return { data, loadout, stance: combatStance(raw.stance) };
}

/** One additive layer's value for attribute index `k`. */
export function layerValue(build: LayeredBuild, layer: AdditiveLayer, k: number): number {
  return build.data[LAYER_OFFSET[layer] + k];
}

/**
 * Attribute values with the chosen attribute layers on, never below zero. The
 * `stance` toggle has no effect here (stance is modelled separately).
 */
export function layeredValues(build: LayeredBuild, toggles: LayerToggles): Float64Array {
  const out = new Float64Array(ATTRIBUTE_COUNT);
  const { data } = build;
  for (let k = 0; k < ATTRIBUTE_COUNT; k++) {
    let value = data[LAYER_OFFSET.base + k];
    if (toggles.tuning) value += data[LAYER_OFFSET.tuning + k];
    if (toggles.weapons) value += data[LAYER_OFFSET.catalog + k];
    if (toggles.refinements) value += data[LAYER_OFFSET.refinements + k];
    if (toggles.loadout) value *= 1 + build.loadout[k];
    out[k] = value > 0 ? value : 0;
  }
  return out;
}
