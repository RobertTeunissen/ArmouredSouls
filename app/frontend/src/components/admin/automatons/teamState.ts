/**
 * Teams card rows (Spec #55, R3.6, design §17.2, task 10.3): the Team_Rule
 * teams over slots 1…maxRobots with names, members and state, the Team_Names
 * sized to the count the rule needs, and the collapsed one-line summary.
 */
import type { TeamNames } from '../../../utils/automatonAdminApi';
import { requiredTeamNameCounts, teamsForSlots } from '@shared/utils/automatonTeamRule';

export interface TeamRow {
  size: 2 | 3;
  index: number;
  slots: readonly number[];
  name: string;
  /** Live robot names per slot (null when the slot has no robot yet). */
  members: (string | null)[];
  formed: boolean;
  waitsForSlot: number;
}

/** Team rows over slots 1…maxRobots (the same `maxRobots` the Team_Names count uses). */
export function teamRows(maxRobots: number, teamNames: TeamNames, liveNames: ReadonlyMap<number, string>): TeamRow[] {
  const slots = Array.from({ length: Math.max(0, maxRobots) }, (_, i) => i + 1);
  return teamsForSlots(slots).map((team) => {
    const members = team.slots.map((slot) => liveNames.get(slot) ?? null);
    return {
      size: team.size,
      index: team.index,
      slots: team.slots,
      name: (team.size === 2 ? teamNames.twoVsTwo : teamNames.threeVsThree)[team.index] ?? '',
      members,
      formed: members.every((m) => m !== null),
      waitsForSlot: Math.max(...team.slots),
    };
  });
}

/** Team_Names sized to the count the Team_Rule needs at `maxRobots`, keeping the names entered so far. */
export function sizeTeamNames(teamNames: TeamNames, maxRobots: number): TeamNames {
  const counts = requiredTeamNameCounts(maxRobots);
  const fit = (names: readonly string[], count: number): string[] => Array.from({ length: count }, (_, i) => names[i] ?? '');
  return { twoVsTwo: fit(teamNames.twoVsTwo, counts.twoVsTwo), threeVsThree: fit(teamNames.threeVsThree, counts.threeVsThree) };
}

/** Robots column: "Rex, Cody (1+2)", "Fives, robot 4 (3+4)", "robots 5+6", "robots 4–6". */
export function membersText(row: TeamRow): string {
  const range = row.size === 2 ? row.slots.join('+') : `${row.slots[0]}–${row.slots[row.slots.length - 1]}`;
  if (row.members.every((m) => m === null)) return `robots ${range}`;
  const parts = row.members.map((m, i) => m ?? `robot ${row.slots[i]}`);
  return `${parts.join(', ')} (${range})`;
}

export const teamStateText = (row: TeamRow): string => (row.formed ? 'Formed' : `Waits for robot ${row.waitsForSlot}`);

const teamName = (row: TeamRow): string => row.name || `team ${row.slots.join('+')}`;

/** Collapsed line (below 768 px): "{names}: Formed · {n} more wait for robots (next: {team}, robot {n})". */
export function teamsSummary(rows: readonly TeamRow[]): string {
  const formed = rows.filter((r) => r.formed).map(teamName);
  const waiting = rows.filter((r) => !r.formed).sort((a, b) => a.waitsForSlot - b.waitsForSlot);
  const parts: string[] = [];
  if (formed.length > 0) {
    const names = formed.length === 1 ? formed[0] : `${formed.slice(0, -1).join(', ')} and ${formed[formed.length - 1]}`;
    parts.push(`${names}: Formed`);
  }
  if (waiting.length > 0) {
    const next = waiting[0];
    parts.push(`${waiting.length} more wait for robots (next: ${teamName(next)}, robot ${next.waitsForSlot})`);
  }
  return parts.join(' · ') || 'No teams yet.';
}
