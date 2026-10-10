/**
 * Robot_Blueprint sync (Spec #55, R3.11, design §8.7 item 3).
 *
 * Pure part: the stance and yield threshold of every live robot that differ
 * from its blueprint. The executor applies them through
 * `robotSettingsService`. Names (R3.9) and images (R3.10) are not synced here;
 * loadout and Weapon_Path changes are fitted by the weapons Goal.
 */
import type { BlueprintFacts, Stance, StableFacts } from '../stableFacts';

export interface BlueprintDrift {
  robotId: number;
  slotIndex: number;
  /** Set when the robot's stance differs from the blueprint. */
  stance?: Stance;
  /** Set when the robot's yield threshold differs from the blueprint. */
  yieldThreshold?: number;
}

/** Robots (slot order) whose stance or yield threshold differs from their blueprint. */
export function blueprintDrift(facts: StableFacts, blueprints: readonly BlueprintFacts[]): BlueprintDrift[] {
  const drift: BlueprintDrift[] = [];
  for (const robot of [...facts.robots].sort((a, b) => a.slotIndex - b.slotIndex)) {
    const blueprint = blueprints.find((b) => b.blueprintId === robot.blueprintId);
    if (!blueprint) continue;
    const entry: BlueprintDrift = { robotId: robot.robotId, slotIndex: robot.slotIndex };
    if (robot.stance !== blueprint.stance) entry.stance = blueprint.stance;
    if (robot.yieldThreshold !== blueprint.yieldThreshold) entry.yieldThreshold = blueprint.yieldThreshold;
    if (entry.stance !== undefined || entry.yieldThreshold !== undefined) drift.push(entry);
  }
  return drift;
}
