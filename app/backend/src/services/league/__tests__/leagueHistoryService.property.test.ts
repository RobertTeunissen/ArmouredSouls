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
  getHistoryByCycleRange,
  getEntityHistory,
  getAggregates,
  detectYoYoCandidates,
  checkCtrlZ,
} from '../leagueHistoryService';
import type {
  EntityType,
  ChangeType,
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
   * Property 5: Cycle range query filtering
   * For any valid cycle range and optional entity type filter, getHistoryByCycleRange
   * passes the correct where clause to Prisma.
   *
   * **Validates: Requirements 5.1**
   */
  describe('Property 5: Cycle range query filtering', () => {
    it('should pass correct cycleNumber range and entityType filter to Prisma', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5000 }), // startCycle
          fc.integer({ min: 0, max: 5000 }), // offset to ensure endCycle >= startCycle
          fc.option(fc.constantFrom<EntityType>('robot', 'tag_team'), { nil: undefined }),
          async (startCycle, offset, entityType) => {
            mockPrisma.leagueHistory.findMany.mockResolvedValue([]);
            mockPrisma.leagueHistory.count.mockResolvedValue(0);

            const endCycle = startCycle + offset;

            await getHistoryByCycleRange({
              startCycle,
              endCycle,
              entityType,
            });

            const expectedWhere: Record<string, unknown> = {
              cycleNumber: { gte: startCycle, lte: endCycle },
            };
            if (entityType) {
              expectedWhere.entityType = entityType;
            }

            expect(mockPrisma.leagueHistory.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expectedWhere,
              })
            );
            expect(mockPrisma.leagueHistory.count).toHaveBeenCalledWith({
              where: expectedWhere,
            });
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
    it('should call Prisma with orderBy cycleNumber asc', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<EntityType>('robot', 'tag_team'),
          fc.integer({ min: 1, max: 10000 }), // entityId
          async (entityType, entityId) => {
            mockPrisma.leagueHistory.findMany.mockResolvedValue([]);

            await getEntityHistory(entityType, entityId);

            expect(mockPrisma.leagueHistory.findMany).toHaveBeenCalledWith({
              where: { entityType, entityId },
              orderBy: { cycleNumber: 'asc' },
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Cycle range validation
   * getHistoryByCycleRange throws when startCycle > endCycle and doesn't throw
   * when startCycle <= endCycle.
   *
   * **Validates: Requirements 5.5, 5.6**
   */
  describe('Property 7: Cycle range validation', () => {
    it('should throw when startCycle > endCycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10000 }), // startCycle (at least 2 so endCycle can be less)
          fc.integer({ min: 1, max: 9999 }), // subtracted from start to get endCycle
          async (startCycle, diff) => {
            const endCycle = startCycle - diff;
            // Only test when startCycle > endCycle
            if (startCycle <= endCycle) return;

            await expect(
              getHistoryByCycleRange({ startCycle, endCycle })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not throw when startCycle <= endCycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5000 }), // startCycle
          fc.integer({ min: 0, max: 5000 }), // offset (endCycle = startCycle + offset)
          async (startCycle, offset) => {
            mockPrisma.leagueHistory.findMany.mockResolvedValue([]);
            mockPrisma.leagueHistory.count.mockResolvedValue(0);

            const endCycle = startCycle + offset;

            await expect(
              getHistoryByCycleRange({ startCycle, endCycle })
            ).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Aggregate count correctness
   * For any set of records, getAggregates computes correct counts per tier.
   *
   * **Validates: Requirements 5.4**
   */
  describe('Property 8: Aggregate count correctness', () => {
    it('should compute correct promotion/demotion counts per tier', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              destinationTier: fc.constantFrom(...LEAGUE_TIERS),
              changeType: fc.constantFrom<ChangeType>('promotion', 'demotion'),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.integer({ min: 1, max: 5000 }), // startCycle
          fc.integer({ min: 0, max: 5000 }), // offset
          async (records, startCycle, offset) => {
            const endCycle = startCycle + offset;

            // Compute expected groupBy result from the records
            const tierChangeMap = new Map<string, number>();
            for (const record of records) {
              const key = `${record.destinationTier}:${record.changeType}`;
              tierChangeMap.set(key, (tierChangeMap.get(key) || 0) + 1);
            }

            const groupByResult = Array.from(tierChangeMap.entries()).map(([key, count]) => {
              const [destinationTier, changeType] = key.split(':');
              return { destinationTier, changeType, _count: { id: count } };
            });

            mockPrisma.leagueHistory.groupBy.mockResolvedValue(groupByResult);

            const result = await getAggregates(startCycle, endCycle);

            // Compute expected aggregates manually
            const expectedMap = new Map<string, { promotions: number; demotions: number }>();
            for (const record of records) {
              if (!expectedMap.has(record.destinationTier)) {
                expectedMap.set(record.destinationTier, { promotions: 0, demotions: 0 });
              }
              const entry = expectedMap.get(record.destinationTier)!;
              if (record.changeType === 'promotion') {
                entry.promotions++;
              } else {
                entry.demotions++;
              }
            }

            // Verify result matches expected
            expect(result.length).toBe(expectedMap.size);
            for (const aggregate of result) {
              const expected = expectedMap.get(aggregate.tier);
              expect(expected).toBeDefined();
              expect(aggregate.promotions).toBe(expected!.promotions);
              expect(aggregate.demotions).toBe(expected!.demotions);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Yo-yo detection correctness
   * Entities with >= minChanges tier changes are returned; those with fewer are not.
   *
   * **Validates: Requirements 10.1**
   */
  describe('Property 9: Yo-yo detection correctness', () => {
    it('should return only entities with >= minChanges tier changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entityType: fc.constantFrom<EntityType>('robot', 'tag_team'),
              entityId: fc.integer({ min: 1, max: 100 }),
              sourceTier: fc.constantFrom(...LEAGUE_TIERS),
              destinationTier: fc.constantFrom(...LEAGUE_TIERS),
            }),
            { minLength: 0, maxLength: 30 }
          ),
          fc.integer({ min: 2, max: 10 }), // minChanges
          async (records, minChanges) => {
            mockPrisma.leagueHistory.findMany.mockResolvedValue(records);
            mockPrisma.cycleMetadata.findUnique.mockResolvedValue({ totalCycles: 100 });

            // Mock batch name resolution for robots and tag teams
            const robotIds = [...new Set(records.filter(r => r.entityType === 'robot').map(r => r.entityId))];
            const tagTeamIds = [...new Set(records.filter(r => r.entityType === 'tag_team').map(r => r.entityId))];
            mockPrisma.robot.findMany.mockResolvedValue(
              robotIds.map(id => ({ id, name: `Robot${id}` }))
            );
            mockPrisma.teamBattle.findMany.mockResolvedValue(
              tagTeamIds.map(id => ({ id, teamName: `Bot${id}A & Bot${id}B` }))
            );

            const result = await detectYoYoCandidates(20, minChanges);

            // Compute expected: group by entityType:entityId, count occurrences
            const entityCounts = new Map<string, number>();
            for (const record of records) {
              const key = `${record.entityType}:${record.entityId}`;
              entityCounts.set(key, (entityCounts.get(key) || 0) + 1);
            }

            // Entities that should be detected
            const expectedKeys = new Set<string>();
            for (const [key, count] of entityCounts) {
              if (count >= minChanges) {
                expectedKeys.add(key);
              }
            }

            // Verify all returned candidates meet the threshold
            for (const candidate of result) {
              const key = `${candidate.entityType}:${candidate.entityId}`;
              expect(expectedKeys.has(key)).toBe(true);
              expect(candidate.changeCount).toBeGreaterThanOrEqual(minChanges);
            }

            // Verify all entities meeting threshold are returned
            expect(result.length).toBe(expectedKeys.size);
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
