import { TEAM_RULE_2V2, TEAM_RULE_3V3, requiredTeamNameCounts, teamsForSlots } from '../teamRule';

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe('teamRule (R3.6, R5.9)', () => {
  it('defines the 2v2 and 3v3 slot groups', () => {
    expect(TEAM_RULE_2V2).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
    expect(TEAM_RULE_3V3).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  });

  it('forms no team with one robot and a 2v2 team with two', () => {
    expect(teamsForSlots([1])).toEqual([]);
    expect(teamsForSlots([1, 2])).toEqual([{ size: 2, index: 0, slots: [1, 2] }]);
  });

  it('lists 2v2 teams first, then 3v3, each in Team_Rule order', () => {
    expect(teamsForSlots([3, 1, 2, 4])).toEqual([
      { size: 2, index: 0, slots: [1, 2] },
      { size: 2, index: 1, slots: [3, 4] },
      { size: 3, index: 0, slots: [1, 2, 3] },
    ]);
  });

  it('puts slot 11 in no team and slots 10 and 11 in no 3v3 team', () => {
    const teams = teamsForSlots(range(11));
    expect(teams.filter((t) => t.size === 2)).toHaveLength(5);
    expect(teams.filter((t) => t.size === 3)).toHaveLength(3);
    expect(teams.some((t) => t.slots.includes(11))).toBe(false);
    expect(teams.filter((t) => t.size === 3).some((t) => t.slots.includes(10))).toBe(false);
  });

  it('needs every member slot alive', () => {
    expect(teamsForSlots([1, 3, 4, 6])).toEqual([{ size: 2, index: 1, slots: [3, 4] }]);
  });

  it.each([
    [1, 0, 0], [2, 1, 0], [3, 1, 1], [4, 2, 1], [5, 2, 1], [6, 3, 2],
    [7, 3, 2], [8, 4, 2], [9, 4, 3], [10, 5, 3], [11, 5, 3],
  ])('needs Team_Names for %i robots: %i 2v2 and %i 3v3', (robots, twoVsTwo, threeVsThree) => {
    expect(requiredTeamNameCounts(robots)).toEqual({ twoVsTwo, threeVsThree });
  });
});
