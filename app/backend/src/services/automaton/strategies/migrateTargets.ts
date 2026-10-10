/**
 * Goal_Target migration between Strategy_Versions (Spec #55, R6.6, R14.1,
 * design §14.0a, task 3.7).
 *
 * Goals are matched by `(type, facilityType, occurrence of that pair)`: the
 * second Booking Office Goal of v1 maps to the second Booking Office Goal of
 * v2, wherever it sits. A matched target is clamped to the new bounds, a new
 * Goal gets its default, a Goal that no longer exists is dropped. Pure; the
 * upgrade service shows the changes for confirmation before saving.
 */
import type { StrategyParametersV1 } from '../../../types/automaton';
import type { FacilityType } from '../stableFacts';
import { resolveGoalTarget } from './strategyParameters';
import type { GoalSpec, GoalType } from './strategyTypes';

export type TargetChangeStatus = 'kept' | 'clamped' | 'new' | 'removed';

export interface TargetChange {
  status: TargetChangeStatus;
  type: GoalType;
  facilityType?: FacilityType;
  /** Goal id in the old version; null for a new Goal. */
  fromGoalId: string | null;
  /** Goal id in the new version; null for a removed Goal. */
  toGoalId: string | null;
  /** Position in the new Build_Order; null for a removed Goal. */
  position: number | null;
  oldTarget: number | null;
  newTarget: number | null;
}

export interface TargetMigration {
  params: StrategyParametersV1;
  /** New Build_Order order first, then the removed Goals in their old order. */
  changes: TargetChange[];
}

function matchKeys(buildOrder: readonly GoalSpec[]): string[] {
  const seen = new Map<string, number>();
  return buildOrder.map((spec) => {
    const pair = `${spec.type}|${spec.facilityType ?? ''}`;
    const occurrence = seen.get(pair) ?? 0;
    seen.set(pair, occurrence + 1);
    return `${pair}|${occurrence}`;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Migrate `params` from the Build_Order `from` to the Build_Order `to`. */
export function migrateTargets(
  from: readonly GoalSpec[],
  to: readonly GoalSpec[],
  params: StrategyParametersV1,
): TargetMigration {
  const fromKeys = matchKeys(from);
  const fromByKey = new Map(from.map((spec, i) => [fromKeys[i], spec]));
  const toKeys = matchKeys(to);
  const matched = new Set<string>();
  const targets: Record<string, number> = {};
  const changes: TargetChange[] = [];

  to.forEach((spec, i) => {
    const facility = spec.facilityType ? { facilityType: spec.facilityType } : {};
    const old = fromByKey.get(toKeys[i]);
    if (!old) {
      targets[spec.id] = spec.defaultTarget;
      changes.push({
        status: 'new', type: spec.type, ...facility, fromGoalId: null, toGoalId: spec.id,
        position: spec.position, oldTarget: null, newTarget: spec.defaultTarget,
      });
      return;
    }
    matched.add(toKeys[i]);
    const oldTarget = resolveGoalTarget(old, params);
    const newTarget = clamp(oldTarget, spec.bounds.min, spec.bounds.max);
    targets[spec.id] = newTarget;
    changes.push({
      status: newTarget === oldTarget ? 'kept' : 'clamped', type: spec.type, ...facility,
      fromGoalId: old.id, toGoalId: spec.id, position: spec.position, oldTarget, newTarget,
    });
  });

  from.forEach((spec, i) => {
    if (matched.has(fromKeys[i])) return;
    changes.push({
      status: 'removed', type: spec.type, ...(spec.facilityType ? { facilityType: spec.facilityType } : {}),
      fromGoalId: spec.id, toGoalId: null, position: null, oldTarget: resolveGoalTarget(spec, params), newTarget: null,
    });
  });

  return { params: { targets }, changes };
}
