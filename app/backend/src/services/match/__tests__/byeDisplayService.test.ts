import prisma from '../../../lib/prisma';
import {
  BYE_MODES,
  BYE_MODE_SPECS,
  resolveByeReward,
  type ByeRewardInput,
} from '../../../utils/byeRewards';
import {
  getAwardedByeReward,
  getExpectedByeReward,
  type ByeDisplayContext,
} from '../byeDisplayService';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    battleParticipant: {
      findMany: jest.fn(),
    },
  },
}));

describe('byeDisplayService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should expose the shared expected reward for every bye mode', () => {
    for (const mode of BYE_MODES) {
      const input = (BYE_MODE_SPECS[mode].floor === 'tier_scaled'
        ? { mode, tier: 'bronze' }
        : { mode, totalParticipants: 16, currentRound: 2, maxRounds: 4 }) as ByeDisplayContext;
      const expected = resolveByeReward(input as ByeRewardInput);

      expect(getExpectedByeReward(input)).toEqual({
        byeRewardCredits: expected.credits,
        byeRewardStatus: 'expected',
      });
    }
  });

  it('should sum persisted participant credits for an awarded bye', async () => {
    (prisma.battleParticipant.findMany as jest.Mock).mockResolvedValue([
      { credits: 17 },
      { credits: 18 },
    ]);

    await expect(getAwardedByeReward(42, [10, 11])).resolves.toEqual({
      byeRewardCredits: 35,
      byeRewardStatus: 'awarded',
    });
    expect(prisma.battleParticipant.findMany).toHaveBeenCalledWith({
      where: { battleId: 42, robotId: { in: [10, 11] } },
      select: { credits: true },
    });
  });

  it('should remain pending when no participant credit rows exist', async () => {
    (prisma.battleParticipant.findMany as jest.Mock).mockResolvedValue([]);

    await expect(getAwardedByeReward(42, [10])).resolves.toEqual({
      byeRewardCredits: null,
      byeRewardStatus: 'pending',
    });
  });

  it('should remain pending when the caller has no real robot ids', async () => {
    await expect(getAwardedByeReward(42, [])).resolves.toEqual({
      byeRewardCredits: null,
      byeRewardStatus: 'pending',
    });
    expect(prisma.battleParticipant.findMany).not.toHaveBeenCalled();
  });
});
