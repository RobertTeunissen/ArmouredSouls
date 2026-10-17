/**
 * Season 2 (#522): KotH matchmaking stores the zone radius at scheduling time.
 *
 * Every KotH group is persisted through schedulingService.createMatch with
 * zoneRadius = KOTH_MATCH_DEFAULTS.zoneRadius (7), so the orchestrator never
 * needs a radius fallback.
 */

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const ROBOT_IDS = Array.from({ length: 11 }, (_, i) => i + 1);

const mockPrisma = {
  standing: {
    findMany: jest.fn(async (args: { where: { tier?: string; leagueInstanceId?: string; entityId?: unknown } }) => {
      // Instances per tier: only bronze has one.
      if (args.where.tier !== undefined) {
        return args.where.tier === 'bronze' ? [{ leagueInstanceId: 'bronze_1' }] : [];
      }
      // Robots in the instance.
      if (args.where.leagueInstanceId !== undefined) {
        return ROBOT_IDS.map((entityId) => ({ entityId }));
      }
      // LP lookup.
      return ROBOT_IDS.map((entityId) => ({ entityId, leaguePoints: 100 - entityId }));
    }),
  },
  robot: {
    findMany: jest.fn(async () => ROBOT_IDS.map((id) => ({
      id,
      userId: 100 + id,
      elo: 1500 - id,
      name: `Bot ${id}`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    }))),
  },
  subscription: {
    findMany: jest.fn(async () => ROBOT_IDS.map((robotId) => ({ robotId }))),
  },
};

jest.mock('../../../src/lib/prisma', () => ({ __esModule: true, default: mockPrisma }));

jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: () => ({ isReady: true }),
}));

const mockCreateMatch = jest.fn().mockResolvedValue({ id: 1 });
jest.mock('../../../src/services/scheduling/schedulingService', () => ({
  __esModule: true,
  default: {
    createMatch: (...args: unknown[]) => mockCreateMatch(...args),
    getAlreadyScheduledIds: jest.fn().mockResolvedValue(new Set<number>()),
  },
}));

jest.mock('../../../src/services/scheduling/thinInstanceByes', () => ({
  __esModule: true,
  createThinInstanceByes: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/matchmaking/teamMatchmakingUtils', () => ({
  __esModule: true,
  createRecentOpponentQueryFn: jest.fn(() => jest.fn()),
  getRecentOpponentsBatch: jest.fn().mockResolvedValue(new Map()),
  defaultScheduledFor: () => new Date('2026-10-17T08:00:00Z'),
}));

import { runKothMatchmaking } from '../../../src/services/koth/kothMatchmakingService';
import { KOTH_MATCH_DEFAULTS } from '../../../src/services/arena/koth/kothConfig';

describe('KotH matchmaking — zone radius at scheduling (Season 2)', () => {
  it('uses the Season 2 default radius of 7', () => {
    expect(KOTH_MATCH_DEFAULTS.zoneRadius).toBe(7);
  });

  it('creates every KotH match with zoneRadius 7', async () => {
    const created = await runKothMatchmaking();

    expect(created).toBe(2); // 11 robots → groups of 6 and 5
    expect(mockCreateMatch).toHaveBeenCalledTimes(2);
    for (const [input] of mockCreateMatch.mock.calls as Array<[{ matchType: string; zoneRadius?: number }]>) {
      expect(input.matchType).toBe('koth');
      expect(input.zoneRadius).toBe(7);
    }
  });
});
