import { teamsDue } from '../upkeep/teamUpkeep';
import type { TeamNames } from '../../../types/automaton';
import { robot, stable, team } from './helpers/automatonFixtures';

const NAMES: TeamNames = {
  twoVsTwo: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'],
  threeVsThree: ['Trident', 'Phalanx', 'Spearhead'],
};
const robotsUpTo = (n: number) => Array.from({ length: n }, (_, i) => robot(i + 1));

describe('team upkeep (R3.6, R5.9)', () => {
  it('registers nothing for one robot', () => {
    expect(teamsDue(stable({ robots: robotsUpTo(1) }), NAMES)).toEqual([]);
  });

  it('registers the 2v2 team of slots 1+2 named from Team_Names', () => {
    expect(teamsDue(stable({ robots: robotsUpTo(2) }), NAMES)).toEqual([
      { size: 2, index: 0, robotIds: [1001, 1002], name: 'Alpha' },
    ]);
  });

  it('skips a team already registered with exactly those robots and registers the 3v3 team', () => {
    const facts = stable({ robots: robotsUpTo(3), teams: [team(9, 2, [1002, 1001], 'Renamed')] });
    expect(teamsDue(facts, NAMES)).toEqual([{ size: 3, index: 0, robotIds: [1001, 1002, 1003], name: 'Trident' }]);
  });

  it('does not count a team of another size or with other members', () => {
    const facts = stable({ robots: robotsUpTo(2), teams: [team(9, 3, [1001, 1002]), team(10, 2, [1001, 5000])] });
    expect(teamsDue(facts, NAMES)).toHaveLength(1);
  });

  it('passes robot ids in ascending Blueprint_Slot order', () => {
    const facts = stable({ robots: [robot(2), robot(1)] });
    expect(teamsDue(facts, NAMES)[0].robotIds).toEqual([1001, 1002]);
  });

  it('forms 5 2v2 and 3 3v3 teams for 11 robots, slot 11 in none', () => {
    const due = teamsDue(stable({ robots: robotsUpTo(11) }), NAMES);
    expect(due.map((d) => d.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Trident', 'Phalanx', 'Spearhead']);
    expect(due.some((d) => d.robotIds.includes(1011))).toBe(false);
  });

  it('reports a missing Team_Names entry as null', () => {
    expect(teamsDue(stable({ robots: robotsUpTo(2) }), { twoVsTwo: [], threeVsThree: [] })[0].name).toBeNull();
  });
});
