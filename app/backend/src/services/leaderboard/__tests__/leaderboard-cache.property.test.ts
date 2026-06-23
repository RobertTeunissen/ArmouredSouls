/**
 * Property-based tests for LeaderboardService cache bounded size.
 *
 * Property 12: After any refresh, for any category, the number of entries
 * written (via createMany) is at most 200 and ranks are sequential 1..N
 * with no gaps.
 */

// --- Mocks (before imports) ---

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    leaderboardCache: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cycleMetadata: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    robot: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    standing: { findMany: jest.fn() },
  },
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../migration/featureFlags', () => ({
  __esModule: true,
  isEnabled: jest.fn(),
}));

// --- Imports ---

import * as fc from 'fast-check';
import { leaderboardService } from '../leaderboardService';
import { isEnabled } from '../../migration/featureFlags';
import prisma from '../../../lib/prisma';

const mockIsEnabled = isEnabled as jest.MockedFunction<typeof isEnabled>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// --- Helpers ---

/**
 * Generate an array of mock robot rows (used for fame, losses, career_wins).
 * Prisma's `take: 200` is simulated by slicing the generated array.
 */
function makeRobotRows(count: number): { id: number; fame: number; losses: number; wins: number }[] {
  return Array.from({ length: Math.min(count, 200) }, (_, i) => ({
    id: i + 1,
    fame: 10000 - i * 10,
    losses: 5000 - i * 5,
    wins: 8000 - i * 8,
  }));
}

/**
 * Generate an array of mock user rows (used for prestige).
 */
function makeUserRows(count: number): { id: number; prestige: number }[] {
  return Array.from({ length: Math.min(count, 200) }, (_, i) => ({
    id: i + 1,
    prestige: 9000 - i * 9,
  }));
}

/**
 * Generate an array of mock standing rows (used for koth_wins, koth_zone_score, team_wins).
 */
function makeStandingRows(count: number): { entityId: number; wins: number; totalZoneScore: number }[] {
  return Array.from({ length: Math.min(count, 200) }, (_, i) => ({
    entityId: i + 1,
    wins: 7000 - i * 7,
    totalZoneScore: 6000 - i * 6,
  }));
}

// --- Property Tests ---

describe('LeaderboardService - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Property 12: Leaderboard Cache Bounded Size — createMany entries are at most 200 with sequential ranks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random source entity counts for robots, users, and standings (0-500)
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        async (robotCount, userCount, standingCount) => {
          // Reset mocks for each iteration
          jest.clearAllMocks();

          // Mock feature flag as enabled
          mockIsEnabled.mockResolvedValue(true);

          // Mock cycleMetadata.findUnique to return a generation
          (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({
            id: 1,
            featureFlags: { leaderboard_active_generation: 1 },
          });

          // Mock cycleMetadata.upsert to succeed
          (mockPrisma.cycleMetadata.upsert as jest.Mock).mockResolvedValue({});

          // Mock robot.findMany — used for fame, losses, career_wins categories
          // Prisma's `take: 200` caps the results, simulated by slicing in makeRobotRows
          (mockPrisma.robot.findMany as jest.Mock).mockResolvedValue(makeRobotRows(robotCount));

          // Mock user.findMany — used for prestige category
          (mockPrisma.user.findMany as jest.Mock).mockResolvedValue(makeUserRows(userCount));

          // Mock standing.findMany — used for koth_wins, koth_zone_score, team_wins categories
          (mockPrisma.standing.findMany as jest.Mock).mockResolvedValue(makeStandingRows(standingCount));

          // Mock leaderboardCache.createMany to capture calls
          (mockPrisma.leaderboardCache.createMany as jest.Mock).mockResolvedValue({ count: 0 });

          // Mock leaderboardCache.deleteMany to succeed
          (mockPrisma.leaderboardCache.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

          // Execute refreshAll
          await leaderboardService.refreshAll();

          // Get all createMany calls
          const createManyCalls = (mockPrisma.leaderboardCache.createMany as jest.Mock).mock.calls;

          // Assert: each createMany call's data array has length <= 200
          for (const call of createManyCalls) {
            const data = call[0].data as Array<{
              category: string;
              rank: number;
              entityType: string;
              entityId: number;
              score: number;
              generation: number;
            }>;

            expect(data.length).toBeLessThanOrEqual(200);

            // Assert: ranks within each createMany data are sequential 1..N with no gaps
            if (data.length > 0) {
              const ranks = data.map((entry) => entry.rank);
              const expectedRanks = Array.from({ length: data.length }, (_, i) => i + 1);
              expect(ranks).toEqual(expectedRanks);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
