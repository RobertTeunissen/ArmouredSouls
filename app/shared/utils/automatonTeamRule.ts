/**
 * Team_Rule (Spec #55, R3.6, R5.9, design §8.7): which Blueprint_Slots form
 * which team. 2v2 teams are slots 1+2, 3+4, 5+6, 7+8, 9+10; 3v3 teams are
 * slots 1–3, 4–6, 7–9. Slot 11 is in no team.
 *
 * Shared by the backend (Team_Names validation, Free_Upkeep) and the admin
 * Editor's Teams card, which recomputes the rows for a blueprint that is
 * added before it is saved.
 */

/** Blueprint_Slots per Automaton stable. */
export const MAX_AUTOMATON_BLUEPRINTS = 11;

export const TEAM_RULE_2V2: readonly (readonly number[])[] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]];
export const TEAM_RULE_3V3: readonly (readonly number[])[] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

export interface TeamRuleTeam {
  size: 2 | 3;
  /** Position within the Team_Rule list of that size; names come from `teamNames[...][index]`. */
  index: number;
  /** Member Blueprint_Slots, ascending. */
  slots: readonly number[];
}

/**
 * Every Team_Rule team whose member slots are all alive, 2v2 first, then 3v3,
 * each in Team_Rule order.
 */
export function teamsForSlots(liveSlots: Iterable<number>): TeamRuleTeam[] {
  const alive = new Set(liveSlots);
  const teams: TeamRuleTeam[] = [];
  TEAM_RULE_2V2.forEach((slots, index) => {
    if (slots.every((s) => alive.has(s))) teams.push({ size: 2, index, slots });
  });
  TEAM_RULE_3V3.forEach((slots, index) => {
    if (slots.every((s) => alive.has(s))) teams.push({ size: 3, index, slots });
  });
  return teams;
}

/**
 * Team_Names the Team_Rule needs at `maxRobots` robots (R3.6):
 * 2v2 ⌊min(n, 10) / 2⌋, 3v3 ⌊min(n, 9) / 3⌋.
 */
export function requiredTeamNameCounts(maxRobots: number): { twoVsTwo: number; threeVsThree: number } {
  const n = Math.max(0, Math.floor(maxRobots));
  return {
    twoVsTwo: Math.floor(Math.min(n, 10) / 2),
    threeVsThree: Math.floor(Math.min(n, 9) / 3),
  };
}

/**
 * Buildable blueprint count (design §6.3 I7): the length of the run of
 * Blueprint_Slots 1…k with no gap.
 */
export function buildableBlueprintCount(slots: Iterable<number>): number {
  const present = new Set(slots);
  let count = 0;
  while (count < MAX_AUTOMATON_BLUEPRINTS && present.has(count + 1)) count++;
  return count;
}

/** The part of a Build_Order Goal the Team_Names count reads. */
export interface RobotsBoundGoal {
  type: string;
  bounds: { max: number };
}

/** Highest robots bound of a Build_Order (0 when it has no robots Goal). */
export function highestRobotsBound(buildOrder: readonly RobotsBoundGoal[]): number {
  return Math.max(0, ...buildOrder.filter((g) => g.type === 'robots').map((g) => g.bounds.max));
}

/**
 * The robot count Team_Names are sized for (R3.6): min(highest robots bound,
 * buildable blueprint count). Feed the result to `requiredTeamNameCounts`.
 */
export function teamNameMaxRobots(buildOrder: readonly RobotsBoundGoal[], buildableCount: number): number {
  return Math.min(highestRobotsBound(buildOrder), buildableCount);
}
