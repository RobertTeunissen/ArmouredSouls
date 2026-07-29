/**
 * Battle event suspension during preparation (Spec #45 R3.1–R3.6).
 *
 * Asserts the gate itself rather than its database side effects: if the handler
 * is never invoked, no matches, battles, or tournaments can be created, which is
 * what R3.3 actually requires. The row-count assertions live in the integration
 * suite where a real database exists.
 *
 * The gate lives in `runJob` rather than in the nine handlers so that adding a
 * tenth battle event cannot skip it — these tests cover all nine plus settlement
 * to prove the distinction holds.
 */

import { runJob, resetScheduler } from '../cycleScheduler';

// The scheduler pulls the season service in dynamically; mock that module.
const mockGetCurrentSeason = jest.fn();
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
}));

// Keep the real logger quiet.
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/** Every job that must be suspended during a preparation window. */
const BATTLE_EVENT_JOBS = [
  'league',
  'tournament',
  'tagTeam',
  'koth',
  'grandMelee',
  'team2v2League',
  'team3v3League',
  'team2v2Tournament',
  'team3v3Tournament',
] as const;

function preparationState(overrides: Record<string, unknown> = {}) {
  return {
    seasonNumber: 4,
    phase: 'preparation',
    seasonCycle: 0,
    seasonLengthCycles: 100,
    remainingCompetitiveCycles: 0,
    preparationDay: 1,
    remainingPreparationCycles: 1,
    isLegacy: false,
    ...overrides,
  };
}

function competitiveState(overrides: Record<string, unknown> = {}) {
  return {
    seasonNumber: 4,
    phase: 'competitive',
    seasonCycle: 12,
    seasonLengthCycles: 100,
    remainingCompetitiveCycles: 88,
    preparationDay: 0,
    remainingPreparationCycles: 0,
    isLegacy: false,
    ...overrides,
  };
}

describe('Season phase gate — R3: battle event suspension during preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetScheduler();
  });

  describe('while the phase is preparation', () => {
    beforeEach(() => {
      mockGetCurrentSeason.mockResolvedValue(preparationState());
    });

    for (const jobName of BATTLE_EVENT_JOBS) {
      it(`should not invoke the ${jobName} handler`, async () => {
        const handler = jest.fn().mockResolvedValue({ jobName });

        await runJob(jobName, handler);

        // Never invoked means no matchmaking, no battle execution, no rebalancing,
        // no tournament creation — and therefore no rows written.
        expect(handler).not.toHaveBeenCalled();
      });
    }

    it('should still run the settlement job, which owns phase advancement', async () => {
      const handler = jest.fn().mockResolvedValue({ jobName: 'settlement' });

      await runJob('settlement', handler);

      // Settlement is not a battle event: it must run so the preparation
      // counter advances and the phase can eventually flip.
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should read the season state once per battle job invocation', async () => {
      await runJob('league', jest.fn().mockResolvedValue({ jobName: 'league' }));

      expect(mockGetCurrentSeason).toHaveBeenCalledTimes(1);
    });
  });

  describe('while the phase is competitive', () => {
    beforeEach(() => {
      mockGetCurrentSeason.mockResolvedValue(competitiveState());
    });

    for (const jobName of BATTLE_EVENT_JOBS) {
      it(`should invoke the ${jobName} handler normally`, async () => {
        const handler = jest.fn().mockResolvedValue({ jobName });

        await runJob(jobName, handler);

        expect(handler).toHaveBeenCalledTimes(1);
      });
    }

    it('should run battle jobs on the cycle the phase becomes competitive', async () => {
      // R3.5: the transition cycle is a normal competitive cycle.
      mockGetCurrentSeason.mockResolvedValue(competitiveState({ seasonCycle: 1 }));
      const handler = jest.fn().mockResolvedValue({ jobName: 'league' });

      await runJob('league', handler);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the season state cannot be read', () => {
    it('should run the job rather than silently stopping the game', async () => {
      // Fail open: suspending every battle event because one read failed is
      // worse than running a cycle during a preparation window.
      mockGetCurrentSeason.mockRejectedValue(new Error('database unreachable'));
      const handler = jest.fn().mockResolvedValue({ jobName: 'league' });

      await runJob('league', handler);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('legacy season', () => {
    it('should run battle jobs normally during Season 0', async () => {
      mockGetCurrentSeason.mockResolvedValue(
        competitiveState({ seasonNumber: 0, isLegacy: true, seasonCycle: 119 }),
      );
      const handler = jest.fn().mockResolvedValue({ jobName: 'league' });

      await runJob('league', handler);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
