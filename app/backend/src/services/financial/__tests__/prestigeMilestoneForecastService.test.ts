import type { SourceProvenance } from '../../../types';
import { calculatePrestigeMilestoneForecast } from '../prestigeMilestoneForecastService';

const PROVENANCE: SourceProvenance = {
  evidenceKind: 'modelled',
  finality: 'completed_historical',
  basis: 'completed_sample',
  asOf: '2026-01-08T00:00:00.000Z',
};

describe('Prestige milestone forecast', () => {
  it('should use only the latest seven completed-cycle samples and ceil the remaining estimate', () => {
    const result = calculatePrestigeMilestoneForecast(970, [
      { cycleNumber: 1, positiveAward: 700 },
      { cycleNumber: 2, positiveAward: 5 },
      { cycleNumber: 3, positiveAward: 5 },
      { cycleNumber: 4, positiveAward: 5 },
      { cycleNumber: 5, positiveAward: 5 },
      { cycleNumber: 6, positiveAward: 5 },
      { cycleNumber: 7, positiveAward: 5 },
      { cycleNumber: 8, positiveAward: 5 },
    ], PROVENANCE);

    expect(result).toMatchObject({
      currentPrestige: 970,
      nextGatePrestige: 1_000,
      remainingPrestige: 30,
      completedCyclesSampled: 7,
      positivePrestigeAwarded: 35,
      averagePerCompletedCycle: 5,
      estimatedCycles: 6,
      status: 'available',
      provenance: PROVENANCE,
    });
  });

  it('should report insufficient history without estimating a milestone', () => {
    const result = calculatePrestigeMilestoneForecast(100, [], PROVENANCE);

    expect(result).toMatchObject({
      nextGatePrestige: 1_000,
      remainingPrestige: 900,
      completedCyclesSampled: 0,
      averagePerCompletedCycle: null,
      estimatedCycles: null,
      status: 'insufficient_history',
    });
  });

  it('should report no positive pace when completed samples have no positive awards', () => {
    const result = calculatePrestigeMilestoneForecast(100, [
      { cycleNumber: 2, positiveAward: 0 },
      { cycleNumber: 1, positiveAward: -50 },
    ], PROVENANCE);

    expect(result).toMatchObject({
      completedCyclesSampled: 2,
      positivePrestigeAwarded: 0,
      averagePerCompletedCycle: 0,
      estimatedCycles: null,
      status: 'no_positive_pace',
    });
  });

  it('should report no next gate after the maximum prestige threshold', () => {
    const result = calculatePrestigeMilestoneForecast(50_000, [
      { cycleNumber: 1, positiveAward: 100 },
    ], PROVENANCE);

    expect(result).toMatchObject({
      nextGatePrestige: null,
      remainingPrestige: null,
      completedCyclesSampled: 1,
      averagePerCompletedCycle: 100,
      estimatedCycles: null,
      status: 'no_next_gate',
    });
  });
});
