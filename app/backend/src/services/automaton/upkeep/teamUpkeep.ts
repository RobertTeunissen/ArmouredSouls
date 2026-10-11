/**
 * Team upkeep (Spec #55, R3.6, R5.9, design §8.7 item 1).
 *
 * Pure part: the Team_Rule teams that are due — every member slot alive and
 * no registered team of that size with exactly those robots — named from the
 * profile's Team_Names. The executor (task 5.4) registers them with
 * `registerTeam` + `createInitialTeamStandings`, passing `robotIds` in
 * ascending Blueprint_Slot order. Teams are never disbanded, swapped or
 * renamed.
 */
import { teamsForSlots } from '../teamRule';
import type { StableFacts } from '../stableFacts';
import type { TeamNames } from '../../../types/automaton';

export interface TeamDue {
  size: 2 | 3;
  /** Position in the Team_Rule list of that size. */
  index: number;
  /** Member robot ids in ascending Blueprint_Slot order. */
  robotIds: number[];
  /** Team_Names entry, or null when the profile has no name for it (recorded as an error). */
  name: string | null;
}

function sameMembers(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** Teams to register, 2v2 first, then 3v3, each in Team_Rule order. */
export function teamsDue(facts: StableFacts, teamNames: TeamNames): TeamDue[] {
  const robotBySlot = new Map(facts.robots.map((r) => [r.slotIndex, r.robotId]));
  const due: TeamDue[] = [];
  for (const team of teamsForSlots(robotBySlot.keys())) {
    const robotIds = team.slots.map((slot) => robotBySlot.get(slot) as number);
    const registered = facts.teams.some((t) => t.size === team.size && sameMembers(t.memberRobotIds, robotIds));
    if (registered) continue;
    const names = team.size === 2 ? teamNames.twoVsTwo : teamNames.threeVsThree;
    due.push({ size: team.size, index: team.index, robotIds, name: names[team.index] ?? null });
  }
  return due;
}
