import prisma from '../src/lib/prisma';
import { rebalanceLeagues, ROBOT_LEAGUE_CONFIG, robotAdapter } from '../src/services/league/leagueRebalancingService';

import { getMinLPForPromotion } from '../src/services/league/leaguePromotionThresholds';



describe('League Rebalancing Service', () => {
  let testUser: any;

  beforeAll(async () => {
    // Clean up in correct order
    await prisma.standing.deleteMany({});
    await prisma.leagueHistory.deleteMany({});
    // KotH schedules folded into the unified scheduled_matches_v2 (Spec #41);
    // participants and battle children cascade with their parent.
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'rebalancing_test_user',
        passwordHash: 'hash',
        currency: 1000000,
      },
    });
  });

  afterEach(async () => {
    // Clean up standings and related data between tests
    await prisma.leagueHistory.deleteMany({});
    await prisma.standing.deleteMany({});
    await prisma.robot.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  /**
   * Helper to create a robot AND its corresponding standings row.
   * The rebalancing service reads from the standings table, not the Robot model.
   */
  async function createRobotWithStanding(opts: {
    name: string;
    tier: string;
    leagueInstanceId: string;
    cyclesInTier: number;
    /**
     * League points on the standing. Required in practice: promotion is gated on a
     * per-tier LP threshold, so a fixture that leaves LP at its default of 0 can
     * never be promoted. This option was missing, which is why every promotion
     * expectation in this file failed once the suite started compiling again — the
     * comments described LP profiles the fixtures never actually created.
     */
    leaguePoints?: number;
    elo?: number;
  }) {
    const robot = await prisma.robot.create({
      data: {
        userId: testUser.id,
        name: opts.name,
        currentHP: 10,
        maxHP: 10,
        currentShield: 2,
        maxShield: 2,
        elo: opts.elo ?? 1200,
        totalBattles: 10,
        loadoutType: 'single',
      },
    });

    const standing = await prisma.standing.create({
      data: {
        entityType: 'robot',
        entityId: robot.id,
        mode: 'league_1v1',
        tier: opts.tier,
        leagueInstanceId: opts.leagueInstanceId,
        cyclesInTier: opts.cyclesInTier,
        leaguePoints: opts.leaguePoints ?? 0,
        wins: 0,
        losses: 0,
        draws: 0,
      },
    });

    return { robot, standing };
  }

  describe('rebalanceLeagues', () => {
    it('should process all tiers and return summary', async () => {
      // 30, not 20. Silver starts empty, and `minCohortForNewTier` refuses to open
      // an empty destination tier with fewer than 3 promotees. The top 10% of 20 is
      // only 2, so the engine correctly held the promotions ("Holding promotions —
      // destination silver is empty, need 3 candidates but only have 2") and this
      // test asked for something its fixture could not produce. 30 gives a cohort of 3.
      for (let i = 0; i < 30; i++) {
        await createRobotWithStanding({
          name: `Bronze ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: 10,
          leaguePoints: i * 5, // robots 5+ clear the bronze threshold of 25
        });
      }

      const summary = await rebalanceLeagues();

      expect(summary.totalRobots).toBeGreaterThanOrEqual(30);
      expect(summary.totalPromoted).toBeGreaterThan(0);
      expect(summary.tierSummaries.length).toBe(6); // All 6 tiers
    });

    it('should not promote or demote entities multiple times in same cycle', async () => {
      // Create 100 bronze standings to trigger promotion
      for (let i = 0; i < 100; i++) {
        await createRobotWithStanding({
          name: `Robot ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: 10,
          leaguePoints: 25 + i, // all clear 25 LP, so the top 10% is exactly 10
          elo: 1200 + i,
        });
      }

      const summary = await rebalanceLeagues();

      // 10% of 100 bronze = 10 promoted to silver
      expect(summary.tierSummaries[0].promoted).toBe(10);
      expect(summary.tierSummaries[0].demoted).toBe(0);

      // Silver tier should have 0 promotions (newly promoted, excluded)
      expect(summary.tierSummaries[1].promoted).toBe(0);
      expect(summary.tierSummaries[1].demoted).toBe(0);

      // Verify standings distribution
      const bronzeCount = await prisma.standing.count({
        where: { mode: 'league_1v1', tier: 'bronze' },
      });
      const silverCount = await prisma.standing.count({
        where: { mode: 'league_1v1', tier: 'silver' },
      });

      expect(bronzeCount).toBe(90);
      expect(silverCount).toBe(10);
    });
  });

  describe('getMinLPForPromotion', () => {
    it('should return correct per-tier LP thresholds', () => {
      expect(getMinLPForPromotion('bronze')).toBe(25);
      expect(getMinLPForPromotion('silver')).toBe(50);
      expect(getMinLPForPromotion('gold')).toBe(75);
      expect(getMinLPForPromotion('platinum')).toBe(100);
      expect(getMinLPForPromotion('diamond')).toBe(125);
      expect(getMinLPForPromotion('champion')).toBe(Infinity);
    });

    it('should return 25 as default for unknown tiers', () => {
      expect(getMinLPForPromotion('unknown')).toBe(25);
    });
  });
});
