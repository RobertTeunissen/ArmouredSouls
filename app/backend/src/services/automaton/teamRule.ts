/**
 * Team_Rule (Spec #55, R3.6, R5.9, design §8.7): which Blueprint_Slots form
 * which team. 2v2 teams are slots 1+2, 3+4, 5+6, 7+8, 9+10; 3v3 teams are
 * slots 1–3, 4–6, 7–9. Slot 11 is in no team.
 */

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
