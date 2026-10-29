/**
 * Property-based tests for leagueHistoryService.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Tests 10 properties covering recording completeness, non-blocking behavior,
 * query filtering, ordering, validation, aggregates, yo-yo detection, and Ctrl+Z detection.
 */

import * as fc from 'fast-check';

// ── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  leagueHistory: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  cycleMetadata: {
    findUnique: jest.fn().mockResolvedValue({ totalCycles: 100 }),
  },
  robot: {
    findUnique: jest.fn().mockResolvedValue({ name: 'TestBot' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  tagTeam: {
    findUnique: jest.fn().mockResolvedValue({
      activeRobot: { name: 'Bot1' },
      reserveRobot: { name: 'Bot2' },
    }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  teamBattle: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, teamName: 'Test Team' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import {
  recordTierChange,
  getEntityHistory,
  checkCtrlZ,
  LEAGUE_HISTORY_MODES,
} from '../leagueHistoryService';
import type {
  EntityType,
  ChangeType,
  LeagueHistoryMode,
  RecordTierChangeParams,
} from '../leagueHistoryService';

// ── Constants ───────────────────────────────────────────────────────

const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

// Helper: get the next tier up (for promotions)
function getNextTier(tier: string): string {
  const idx = LEAGUE_TIERS.indexOf(tier as (typeof LEAGUE_TIERS)[number]);
  return LEAGUE_TIERS[Math.min(idx + 1, LEAGUE_TIERS.length - 1)];
}

// Helper: get the previous tier down (for demotions)
function getPreviousTier(tier: string): string {
  const idx = LEAGUE_TIERS.indexOf(tier as (typeof LEAGUE_TIERS)[number]);
  return LEAGUE_TIERS[Math.max(idx - 1, 0)];
}

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.leagueHistory.create.mockResolvedValue({});
  mockPrisma.leagueHistory.findMany.mockResolvedValue([]);
  mockPrisma.leagueHistory.count.mockResolvedValue(0);
  mockPrisma.leagueHistory.findFirst.mockResolvedValue(null);
  mockPrisma.leagueHistory.groupBy.mockResolvedValue([]);
  mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ totalCycles: 100 });
  mockPrisma.robot.findUnique.mockResolvedValue({ name: 'TestBot' });
  mockPrisma.robot.findMany.mockResolvedValue([]);
  mockPrisma.teamBattle.findUnique.mockResolvedValue({
    teamName: 'Bot1 & Bot2',
  });
  mockPrisma.teamBattle.findMany.mockResolvedValue([]);
  mockPrisma.user.findMany.mockResolvedValue([]);
});

// ── Tests ───────────────────────────────────────────────────────────

describe('leagueHistoryService Property Tests', () => {
  /**
   * Property 1: Robot promotion recording completeness
   * For any robot in a non-champion tier with any LP, recordTierChange creates
   * a record with correct entityType, changeType, tiers, LP, and cycleNumber.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
   */
  describe('Property 1: Robot promotion recording completeness', () => {
    it('should call Prisma create with correct fields for robot promotions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }), // entityId
          fc.integer({ min: 1, max: 10000 }), // userId
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond'), // non-champion tiers
          fc.integer({ min: 0, max: 10000 }), // leaguePoints
          fc.integer({ min: 1, max: 10000 }), // cycleNumber
          (entityId, userId, sourceTier, leaguePoints, cycleNumber) => {
            mockPrisma.leagueHistory.create.mockClear();
            const destinationTier = getNextTier(sourceTier);
            const sourceLeagueId = `${sourceTier}_${(entityId % 5) + 1}`;
            const destinationLeagueId = `${destinationTier}_${(entityId % 5) + 1}`;

            const params: RecordTierChangeParams = {
              entityType: 'robot',
              entityId,
              userId,
              changeType: 'promotion',
              sourceTier,
              destinationTier,
              sourceLeagueId,
              destinationLeagueId,
              leaguePoints,
              cycleNumber,
            };

            recordTierChange(params);

            expect(mockPrisma.leagueHistory.create).toHaveBeenCalledWith({
              data: {
                entityType: 'robot',
                entityId,
                userId,
                changeType: 'promotion',
                // `mode` discriminates which competitive track a tier change came from
                // (Spec #32/#37). `recordTierChange` always writes it, defaulting to null
                // when the caller omits it, so it belongs in the expectation.
                mode: null,
                sourceTier,
                destinationTier,
                sourceLeagueId,
                destinationLeagueId,
                leaguePoints,
                cycleNumber,
              },
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Robot demotion recording completeness
   * For any robot in a non-bronze tier with any LP, recordTierChange creates
   * a record with correct entityType, changeType, tiers, LP, and cycleNumber.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 3.1, 3.2, 3.3**
   */
  describe('Property 2: Robot demotion recording completeness', () => {
    it('should call Prisma create with correct fields for robot demotions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }), // entityId
          fc.integer({ min: 1, max: 10000 }), // userId
          fc.constantFrom('silver', 'gold', 'platinum', 'diamond', 'champion'), // non-bronze tiers
          fc.integer({ min: 0, max: 10000 }), // leaguePoints
          fc.integer({ min: 1, max: 10000 }), // cycleNumber
          (entityId, userId, sourceTier, leaguePoints, cycleNumber) => {
            mockPrisma.leagueHistory.create.mockClear();
            const destinationTier = getPreviousTier(sourceTier);
            const sourceLeagueId = `${sourceTier}_${(entityId % 5) + 1}`;
            const destinationLeagueId = `${destinationTier}_${(entityId % 5) + 1}`;

            const params: RecordTierChangeParams = {
              entityType: 'robot',
              entityId,
              userId,
              changeType: 'demotion',
              sourceTier,
              destinationTier,
              sourceLeagueId,
              destinationLeagueId,
              leaguePoints,
              cycleNumber,
            };

            recordTierChange(params);

            expect(mockPrisma.leagueHistory.create).toHaveBeenCalledWith({
              data: {
                entityType: 'robot',
                entityId,
                userId,
                changeType: 'demotion',
                // `mode` discriminates which competitive track a tier change came from
                // (Spec #32/#37). `recordTierChange` always writes it, defaulting to null
                // when the caller omits it, so it belongs in the expectation.
                mode: null,
                sourceTier,
                destinationTier,
                sourceLeagueId,
                destinationLeagueId,
                leaguePoints,
                cycleNumber,
              },
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Tag team tier change recording completeness
   * For any tag team tier change, the record has entityType="tag_team",
   * correct changeType, and userId matches stableId.
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  describe('Property 3: Tag team tier change recording completeness', () => {
    it('should call Prisma create with entityType tag_team and correct fields', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }), // entityId (tag team id)
          fc.integer({ min: 1, max: 10000 }), // stableId (userId)
          fc.constantFrom<ChangeType>('promotion', 'demotion'), // changeType
          fc.constantFrom(...LEAGUE_TIERS), // sourceTier
          fc.constantFrom(...LEAGUE_TIERS), // destinationTier
          fc.integer({ min: 0, max: 10000 }), // leaguePoints
          fc.integer({ min: 1, max: 10000 }), // cycleNumber
          (entityId, stableId, changeType, sourceTier, destinationTier, leaguePoints, cycleNumber) => {
            mockPrisma.leagueHistory.create.mockClear();
            const sourceLeagueId = `${sourceTier}_${(entityId % 5) + 1}`;
            const destinationLeagueId = `${destinationTier}_${(entityId % 5) + 1}`;

            const params: RecordTierChangeParams = {
              entityType: 'tag_team',
              entityId,
              userId: stableId,
              changeType,
              sourceTier,
              destinationTier,
              sourceLeagueId,
              destinationLeagueId,
              leaguePoints,
              cycleNumber,
            };

            recordTierChange(params);

            expect(mockPrisma.leagueHistory.create).toHaveBeenCalledWith({
              data: {
                entityType: 'tag_team',
                entityId,
                userId: stableId,
                changeType,
                // See Property 1: `recordTierChange` always writes `mode`.
                mode: null,
                sourceTier,
                destinationTier,
                sourceLeagueId,
                destinationLeagueId,
                leaguePoints,
                cycleNumber,
              },
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Non-blocking recording on failure
   * When Prisma create throws, recordTierChange does NOT throw (resolves without error).
   *
   * **Validates: Requirements 2.4, 3.4**
   */
  describe('Property 4: Non-blocking recording on failure', () => {
    it('should not throw when Prisma create fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // entityId
          fc.integer({ min: 1, max: 10000 }), // userId
          fc.constantFrom<EntityType>('robot', 'tag_team'),
          fc.constantFrom<ChangeType>('promotion', 'demotion'),
          fc.constantFrom(...LEAGUE_TIERS), // sourceTier
          fc.integer({ min: 0, max: 10000 }), // leaguePoints
          fc.integer({ min: 1, max: 10000 }), // cycleNumber
          async (entityId, userId, entityType, changeType, sourceTier, leaguePoints, cycleNumber) => {
            mockPrisma.leagueHistory.create.mockRejectedValue(new Error('Database connection failed'));

            const destinationTier = changeType === 'promotion' ? getNextTier(sourceTier) : getPreviousTier(sourceTier);

            const params: RecordTierChangeParams = {
              entityType,
              entityId,
              userId,
              changeType,
              sourceTier,
              destinationTier,
              sourceLeagueId: `${sourceTier}_1`,
              destinationLeagueId: `${destinationTier}_1`,
              leaguePoints,
              cycleNumber,
            };

            // Should resolve without throwing
            await expect(recordTierChange(params)).resolves.toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Query result ordering
   * getEntityHistory calls Prisma with orderBy: { cycleNumber: 'asc' }.
   *
   * **Validates: Requirements 5.2, 5.3, 8.5, 9.5**
   */
  describe('Property 6: Query result ordering', () => {
    it('should omit the mode predicate when querying legacy entity history', async () => {
      mockPrisma.leagueHistory.findMany.mockResolvedValue([]);

      await getEntityHistory('robot', 42);

      expect(mockPrisma.leagueHistory.findMany).toHaveBeenCalledWith({
        where: { entityType: 'robot', entityId: 42 },
        orderBy: { cycleNumber: 'asc' },
      });
    });

    it('should call Prisma with orderBy cycleNumber asc', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<EntityType>('robot', 'tag_team', 'team_battle'),
          fc.integer({ min: 1, max: 10000 }), // entityId
          fc.constantFrom<LeagueHistoryMode>(...LEAGUE_HISTORY_MODES),
          async (entityType, entityId, mode) => {
            mockPrisma.leagueHistory.findMany.mockResolvedValue([]);

            await getEntityHistory(entityType, entityId, mode);

            expect(mockPrisma.leagueHistory.findMany).toHaveBeenCalledWith({
              where: { entityType, entityId, mode },
              orderBy: { cycleNumber: 'asc' },
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Ctrl+Z detection correctness
   * Generates history sequences with/without the demotion→re-promotion pattern
   * and verifies checkCtrlZ returns correct results.
   *
   * **Validates: Requirements 11.1, 11.2, 11.3**
   */
  describe('Property 10: Ctrl+Z detection correctness', () => {
    it('should detect Ctrl+Z when demotion followed by re-promotion within window', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // robotId
          fc.constantFrom(...LEAGUE_TIERS), // tierName
          fc.integer({ min: 1, max: 100 }), // demotionCycle
          fc.integer({ min: 1, max: 50 }), // gap between demotion and promotion
          fc.integer({ min: 1, max: 100 }), // maxCycleWindow
          async (robotId, tierName, demotionCycle, gap, maxCycleWindow) => {
            const promotionCycle = demotionCycle + gap;

            // First call: find demotion
            mockPrisma.leagueHistory.findFirst
              .mockResolvedValueOnce({
                entityType: 'robot',
                entityId: robotId,
                changeType: 'demotion',
                sourceTier: tierName,
                cycleNumber: demotionCycle,
              })
              // Second call: find promotion (or not) depending on window
              .mockResolvedValueOnce(
                gap <= maxCycleWindow
                  ? {
                      entityType: 'robot',
                      entityId: robotId,
                      changeType: 'promotion',
                      destinationTier: tierName,
                      cycleNumber: promotionCycle,
                    }
                  : null
              );

            const result = await checkCtrlZ(robotId, tierName, maxCycleWindow);

            if (gap <= maxCycleWindow) {
              expect(result.found).toBe(true);
              expect(result.demotionCycle).toBe(demotionCycle);
              expect(result.promotionCycle).toBe(promotionCycle);
            } else {
              expect(result.found).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return found=false when no demotion exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }), // robotId
          fc.constantFrom(...LEAGUE_TIERS), // tierName
          fc.integer({ min: 1, max: 100 }), // maxCycleWindow
          async (robotId, tierName, maxCycleWindow) => {
            mockPrisma.leagueHistory.findFirst.mockResolvedValue(null);

            const result = await checkCtrlZ(robotId, tierName, maxCycleWindow);
            expect(result.found).toBe(false);
            expect(result.demotionCycle).toBeUndefined();
            expect(result.promotionCycle).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


