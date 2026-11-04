/**
 * Tag team yields and battle-time max HP, as used for the participant rows and
 * the achievement context (C23 "Run Away!", HP-based achievements).
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { getTagTeamYields } from '../tagTeamBattleRecord';
import { battleTimeMaxHP } from '../tagTeamResultUpdater';

const names = { team1Active: 'A1', team1Reserve: 'R1', team2Active: 'A2', team2Reserve: 'R2' };
const base = {
  battleLog: [],
  team1TagOutTime: undefined,
  team2TagOutTime: undefined,
  team1ActiveFinalHP: 500,
  team1ReserveFinalHP: 900,
  team2ActiveFinalHP: 400,
  team2ReserveFinalHP: 800,
};

describe('getTagTeamYields', () => {
  it('counts a tag-out with HP left as a yield', () => {
    const yields = getTagTeamYields({ ...base, team1TagOutTime: 30, team1ActiveFinalHP: 120 }, names);
    expect(yields).toEqual({ team1Active: true, team1Reserve: false, team2Active: false, team2Reserve: false });
  });

  it('does not count a destruction-triggered tag-out', () => {
    const yields = getTagTeamYields({ ...base, team2TagOutTime: 45, team2ActiveFinalHP: 0 }, names);
    expect(yields.team2Active).toBe(false);
  });

  it('counts a reserve that yields outright', () => {
    const yields = getTagTeamYields({ ...base, battleLog: [{ timestamp: 60, type: 'yield', defender: 'R2' }] }, names);
    expect(yields.team2Reserve).toBe(true);
    expect(yields.team1Reserve).toBe(false);
  });

  it('reports no yields when nobody left the fight', () => {
    expect(Object.values(getTagTeamYields(base, names)).some(Boolean)).toBe(false);
  });
});

describe('battleTimeMaxHP', () => {
  it('maps every robot in the phases to its combat max HP', () => {
    const phases = [
      { robot1Name: 'A1', robot2Name: 'A2', robot1Stance: 'balanced', robot2Stance: 'balanced', robot1MaxHP: 1250, robot2MaxHP: 1100 },
      { robot1Name: 'R1', robot2Name: 'A2', robot1Stance: 'balanced', robot2Stance: 'balanced', robot1MaxHP: 980, robot2MaxHP: 1100 },
    ];
    const map = battleTimeMaxHP(phases);
    expect(map.get('A1')).toBe(1250);
    expect(map.get('R1')).toBe(980);
    expect(map.get('A2')).toBe(1100);
    expect(map.has('R2')).toBe(false);
  });
});
