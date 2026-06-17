/**
 * Parity test: shared `calculateRepairCost` must produce identical results
 * to the backend's `calculateRepairCost` in `src/utils/robotCalculations.ts`.
 *
 * This prevents the shared formula from drifting out of sync.
 */

import { calculateRepairCost as backendCalc } from '../src/utils/robotCalculations';
import { calculateRepairCost as sharedCalc } from '../src/shared/utils/repairCost';

describe('Shared repairCost parity with backend', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  const testCases: {
    label: string;
    args: [number, number, number, number?, number?, number?];
  }[] = [
    { label: 'total destruction, no discount', args: [230, 100, 0] },
    { label: 'heavy damage (5% HP)', args: [230, 95, 5] },
    { label: 'normal damage (15% HP)', args: [230, 85, 15] },
    { label: 'light damage (40% HP)', args: [230, 60, 40] },
    { label: 'no damage', args: [230, 0, 50] },
    { label: 'repair bay level 5, no robots', args: [230, 100, 0, 5] },
    { label: 'repair bay level 5, medicalBay 0, 4 robots', args: [230, 100, 0, 5, 0, 4] },
    { label: 'repair bay level 10, medicalBay 0, 0 robots', args: [230, 100, 0, 10, 0, 0] },
    { label: 'repair bay level 3, medicalBay 0, 10 robots', args: [230, 50, 25, 3, 0, 10] },
    { label: 'cap at 90% discount', args: [230, 100, 0, 10, 0, 20] },
    { label: 'fractional attribute sum', args: [230.75, 80, 20, 2, 0, 5] },
    { label: 'small attribute sum', args: [23, 100, 0, 0, 0, 0] },
    { label: 'large attribute sum', args: [2300, 50, 50, 5, 0, 3] },
  ];

  it.each(testCases)('$label', ({ args }) => {
    const backendResult = backendCalc(...args);
    const sharedResult = sharedCalc(...args);
    expect(sharedResult).toBe(backendResult);
  });
});
