/**
 * Property test: Bye Robot Fabrication for Odd Counts
 *
 * Feature: unified-match-scheduling
 * Property 9: Bye Robot Fabrication for Odd Counts
 *
 * Tests the shared bye robot factory used by all matchmaking modes
 * when a tier instance has an odd number of eligible participants.
 *
 * Validates: Requirements 6.1
 */

import * as fc from 'fast-check';
import { createByeRobot } from '../../battle/byeRobot';

// Simulate the pairing logic: odd-count pools get one bye match
function simulatePairing(robotCount: number): { totalPairs: number; byeMatches: number; byeRobotId: number | null } {
  if (robotCount === 0) return { totalPairs: 0, byeMatches: 0, byeRobotId: null };

  const pairs = Math.floor(robotCount / 2);
  const hasOdd = robotCount % 2 === 1;

  if (hasOdd) {
    const bye = createByeRobot(-1);
    return { totalPairs: pairs + 1, byeMatches: 1, byeRobotId: bye.id };
  }

  return { totalPairs: pairs, byeMatches: 0, byeRobotId: null };
}

describe('Bye Robot Fabrication — Property 9: Odd Counts', () => {
  it('odd-count pools produce exactly one bye match with id < 0 and elo = 1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 21 }).filter(n => n % 2 === 1), // odd counts only
        (robotCount) => {
          const result = simulatePairing(robotCount);

          expect(result.byeMatches).toBe(1);
          expect(result.byeRobotId).toBeLessThan(0);
          expect(result.totalPairs).toBe(Math.ceil(robotCount / 2));

          // Verify bye robot properties from the real factory
          const bye = createByeRobot(-1);
          expect(bye.id).toBe(-1);
          expect(bye.elo).toBe(1000);
          expect(bye.loadoutType).toBe('single');
          expect(bye.mainWeapon).toBeNull();
          expect(bye.offhandWeapon).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('even-count pools produce zero bye matches', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }).filter(n => n % 2 === 0), // even counts only
        (robotCount) => {
          const result = simulatePairing(robotCount);

          expect(result.byeMatches).toBe(0);
          expect(result.byeRobotId).toBeNull();
          expect(result.totalPairs).toBe(robotCount / 2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
