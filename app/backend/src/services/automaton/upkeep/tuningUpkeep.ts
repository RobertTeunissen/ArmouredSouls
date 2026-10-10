/**
 * Tuning upkeep (Spec #55, R4.5, design §8.4, §8.7 item 4).
 *
 * Pure part: each live robot's tuning allocation by its Build_Focus
 * (`computeTuningSplit`), within the pool and per-attribute limits
 * `setTuningAllocation` validates, and whether it differs from the current
 * allocation. The executor writes only the robots that differ.
 */
import { buildPerAttributeMaxes } from '../../tuning-pool/tuningPoolService';
import { getPoolSize } from '../../tuning-pool/tuningPoolConfig';
import { computeTuningSplit, type BuildFocusWeightTable, type GroupWeights } from '../buildFocus';
import type { BlueprintFacts, RobotFacts, StableFacts } from '../stableFacts';
import { ROBOT_ATTRIBUTES, type RobotAttribute } from '../../../shared/utils/robotAttributes';

const ACADEMY_TYPES = [
  'combat_training_academy',
  'defense_training_academy',
  'mobility_training_academy',
  'ai_training_academy',
] as const;

/** Desired allocation for one robot. */
export function desiredTuningAllocation(
  facts: StableFacts,
  robot: RobotFacts,
  weights: GroupWeights,
): Record<RobotAttribute, number> {
  const academyLevels = Object.fromEntries(ACADEMY_TYPES.map((type) => [type, facts.facilities[type]]));
  const maxes = buildPerAttributeMaxes(robot.attributes, academyLevels);
  return computeTuningSplit(weights, getPoolSize(facts.facilities.tuning_bay), maxes);
}

/** Whether two allocations differ at 2-decimal precision (absent = 0). */
export function tuningDiffers(
  current: Partial<Record<RobotAttribute, number>>,
  desired: Partial<Record<RobotAttribute, number>>,
): boolean {
  return ROBOT_ATTRIBUTES.some((a) => Math.round((current[a] ?? 0) * 100) !== Math.round((desired[a] ?? 0) * 100));
}

export interface TuningChange {
  robotId: number;
  allocation: Record<RobotAttribute, number>;
}

/** Robots (slot order) whose desired allocation differs from the current one. */
export function tuningChanges(
  facts: StableFacts,
  blueprints: readonly BlueprintFacts[],
  weightTable: BuildFocusWeightTable,
): TuningChange[] {
  const changes: TuningChange[] = [];
  for (const robot of [...facts.robots].sort((a, b) => a.slotIndex - b.slotIndex)) {
    const blueprint = blueprints.find((b) => b.blueprintId === robot.blueprintId);
    if (!blueprint) continue;
    const allocation = desiredTuningAllocation(facts, robot, weightTable[blueprint.buildFocus]);
    if (tuningDiffers(robot.tuning, allocation)) changes.push({ robotId: robot.robotId, allocation });
  }
  return changes;
}
