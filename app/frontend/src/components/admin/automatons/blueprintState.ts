/**
 * Robot_Blueprint card helpers (Spec #55, PLAYER_FACING_TEXT §6.5, task
 * 10.3): the card item, the Refinement_Plan step costs (shared formula) and
 * the collapsed header line.
 */
import type { BlueprintFields, CatalogueWeapon, RefinementStep } from '../../../utils/automatonAdminApi';
import { calculateRefinementCost } from '@shared/utils/weaponRefinement';
import { BUILD_FOCUS_NAMES, LOADOUT_LABELS, STANCE_LABELS, stageRangeBand } from './automatonText';

export interface BlueprintEditorItem {
  slot: number;
  fields: BlueprintFields;
  imageUrl: string | null;
  liveRobot: { id: number; name: string } | null;
  /** Added in the Editor and not saved yet. */
  pending: boolean;
}

/** Cost of each plan step: Sharpen/Forge get dearer per earlier instance on the same weapon. */
export function refinementStepCosts(plan: readonly RefinementStep[]): number[] {
  const seen = new Map<string, number>();
  return plan.map((step) => {
    const key = `${step.hand}:${step.tier}`;
    const existing = seen.get(key) ?? 0;
    seen.set(key, existing + 1);
    return calculateRefinementCost(step.tier, step.magnitude, existing);
  });
}

/** Header: "{slot} · {robot name}" and "{loadout} · {stance} · {build focus} · range {range} (from weapons) · in play / not bought yet". */
export function blueprintHeader(item: BlueprintEditorItem, weapons: ReadonlyMap<string, CatalogueWeapon>): { title: string; summary: string } {
  const f = item.fields;
  const last = f.weaponPath[f.weaponPath.length - 1];
  const state = item.liveRobot ? 'in play' : 'not bought yet';
  return {
    title: `${item.slot} · ${f.robotName}`,
    summary: `${LOADOUT_LABELS[f.loadoutType]} · ${STANCE_LABELS[f.stance]} · ${BUILD_FOCUS_NAMES[f.buildFocus]} · range ${stageRangeBand(last, f.loadoutType, weapons)} (from weapons) · ${state}`,
  };
}
