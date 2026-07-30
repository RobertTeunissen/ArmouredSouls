/**
 * Unit tests for preserved-state achievement re-awarding (issue #419).
 *
 * A Season_Rollover purges `user_achievements` but preserves onboarding state,
 * so E1 "Hello World" was unreachable for returning players: the condition
 * stayed true and nothing re-evaluated it.
 */

const mockUserFindMany = jest.fn();
const mockCheckAndAward = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: (...args: unknown[]) => mockUserFindMany(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/achievement/achievementService', () => ({
  achievementService: {
    checkAndAward: (...args: unknown[]) => mockCheckAndAward(...args),
  },
}));

import {
  reawardPreservedStateAchievements,
  PRESERVED_STATE_TRIGGERS,
  PRESERVED_STATE_EVENTS,
} from '../../../src/services/achievement/preservedStateAchievements';
import { EVENT_TRIGGER_MAP } from '../../../src/services/achievement/achievementTypes';
import { ACHIEVEMENTS } from '../../../src/config/achievements';

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckAndAward.mockResolvedValue([]);
});

describe('reawardPreservedStateAchievements', () => {
  it('should replay the preserved-state event for every eligible stable', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 4 }, { id: 9 }]);

    await reawardPreservedStateAchievements();

    expect(mockCheckAndAward).toHaveBeenCalledTimes(2);
    expect(mockCheckAndAward).toHaveBeenCalledWith(4, null, {
      type: 'onboarding_complete',
      data: {},
    });
    expect(mockCheckAndAward).toHaveBeenCalledWith(9, null, {
      type: 'onboarding_complete',
      data: {},
    });
  });

  it('should only consider human stables that completed onboarding', async () => {
    mockUserFindMany.mockResolvedValue([]);

    await reawardPreservedStateAchievements();

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGenerated: false, hasCompletedOnboarding: true },
      }),
    );
  });

  it('should report how many achievements were awarded', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockCheckAndAward
      .mockResolvedValueOnce([{ id: 'E1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'E1' }]);

    const result = await reawardPreservedStateAchievements();

    expect(result).toEqual({ stablesChecked: 3, achievementsAwarded: 2 });
  });

  it('should award nothing on a second run, since unlocks are already held', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 1 }]);
    // checkAndAward filters achievements the player already holds.
    mockCheckAndAward.mockResolvedValue([]);

    const result = await reawardPreservedStateAchievements();

    expect(result.achievementsAwarded).toBe(0);
  });

  it('should keep sweeping when one stable fails', async () => {
    mockUserFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockCheckAndAward
      .mockResolvedValueOnce([{ id: 'E1' }])
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockResolvedValueOnce([{ id: 'E1' }]);

    const result = await reawardPreservedStateAchievements();

    expect(result).toEqual({ stablesChecked: 3, achievementsAwarded: 2 });
  });

  it('should do nothing when no stable is eligible', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const result = await reawardPreservedStateAchievements();

    expect(result).toEqual({ stablesChecked: 0, achievementsAwarded: 0 });
    expect(mockCheckAndAward).not.toHaveBeenCalled();
  });
});

describe('preserved-state trigger configuration', () => {
  it('should make every preserved-state trigger reachable from a replayed event', () => {
    const reachable = new Set(
      PRESERVED_STATE_EVENTS.flatMap((event) => EVENT_TRIGGER_MAP[event] ?? []),
    );

    for (const trigger of PRESERVED_STATE_TRIGGERS) {
      expect(reachable).toContain(trigger);
    }
  });

  it('should have at least one achievement behind every preserved-state trigger', () => {
    for (const trigger of PRESERVED_STATE_TRIGGERS) {
      const matching = ACHIEVEMENTS.filter((a) => a.triggerType === trigger);
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  // The specific case from issue #419. `hasCompletedOnboarding` survives a
  // rollover, so E1 must be in the replay set or it can never be re-earned.
  it('should cover the onboarding achievement', () => {
    expect(PRESERVED_STATE_TRIGGERS).toContain('onboarding');
    expect(ACHIEVEMENTS.some((a) => a.id === 'E1' && a.triggerType === 'onboarding')).toBe(true);
  });
});
