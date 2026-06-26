import prisma from '../src/lib/prisma';
import {
  determinePromotions,
  determineDemotions,
  promoteRobot,
  demoteRobot,
  rebalanceLeagues,
  getMinLPForPromotion,
} from '../src/services/league/leagueRebalancingService';


describe('League Rebalancing Service', () => {
  let testUser: any;

  beforeAll(async () => {
    // Clean up in correct order
    await prisma.standing.deleteMany({});
    await prisma.leagueHistory.deleteMany({});
    await prisma.scheduledKothMatchParticipant.deleteMany({});
    await prisma.scheduledKothMatch.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
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
        wins: 0,
        losses: 0,
        draws: 0,
      },
    });

    return { robot, standing };
  }

  describe('determinePromotions', () => {
    it('should return top 10% of standings with ≥5 cycles AND per-tier LP threshold', async () => {
      // Create 20 robots in bronze with corresponding standings
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Bronze Robot ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: 10,
        });
      }

      const toPromote = await determinePromotions('bronze_1');

      // Top 10% of 20 eligible = 2, only those with ≥25 LP (bronze threshold)
      // Robots 5-19 have ≥25 LP (15 robots), top 2 are entityIds for robots 19 and 18
      expect(toPromote.length).toBe(2);
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(25);
      expect(toPromote[1].leaguePoints).toBeGreaterThanOrEqual(25);
      // Results ordered by LP desc
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(toPromote[1].leaguePoints);
    });

    it('should skip standings with <5 cycles in current tier', async () => {
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Bronze Robot ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: i < 10 ? 3 : 10, // First 10 have too few cycles
        });
      }

      const toPromote = await determinePromotions('bronze_1');

      // Only robots 10-19 have ≥5 cycles (10 entities eligible)
      // Of those, only robots 5-19 have ≥25 LP. Intersection: robots 10-19 (10 entities)
      // Top 10% of 10 = 1 entity
      expect(toPromote.length).toBe(1);
      expect(toPromote[0].cyclesInTier).toBeGreaterThanOrEqual(5);
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(25);
    });

    it('should return empty array for champion tier', async () => {
      const toPromote = await determinePromotions('champion_1');
      expect(toPromote).toEqual([]);
    });

    it('should return empty array when no standings meet per-tier LP threshold', async () => {
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Low Points Robot ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: 10,
        });
      }

      const toPromote = await determinePromotions('bronze_1');
      expect(toPromote).toEqual([]);
    });

    it('should use higher LP threshold for silver tier (50 LP for Silver→Gold)', async () => {
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Silver Threshold Robot ${i}`,
          tier: 'silver',
          leagueInstanceId: 'silver_1',
          cyclesInTier: 10,
        });
      }

      const toPromote = await determinePromotions('silver_1');

      // Top 10% of 20 = 2 slots, only robots with ≥50 LP qualify
      expect(toPromote.length).toBe(2);
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(50);
      expect(toPromote[1].leaguePoints).toBeGreaterThanOrEqual(50);
    });

    it('should not promote silver standings with 25-49 LP (below silver threshold)', async () => {
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Silver Below Threshold ${i}`,
          tier: 'silver',
          leagueInstanceId: 'silver_1',
          cyclesInTier: 10,
        });
      }

      const toPromote = await determinePromotions('silver_1');
      expect(toPromote).toEqual([]);
    });

    it('should return empty array when too few entities (< min for rebalancing)', async () => {
      for (let i = 0; i < 5; i++) {
        await createRobotWithStanding({
          name: `Small League Robot ${i}`,
          tier: 'gold',
          leagueInstanceId: 'gold_1',
          cyclesInTier: 10,
        });
      }

      const toPromote = await determinePromotions('gold_1');
      expect(toPromote).toEqual([]);
    });
  });

  describe('determineDemotions', () => {
    it('should return bottom 10% of standings with ≥5 cycles in tier', async () => {
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Silver Robot ${i}`,
          tier: 'silver',
          leagueInstanceId: 'silver_1',
          cyclesInTier: 10,
        });
      }

      const toDemote = await determineDemotions('silver_1');

      // Bottom 10% = 2 entities (lowest LP)
      expect(toDemote.length).toBe(2);
      expect(toDemote[0].leaguePoints).toBeLessThanOrEqual(toDemote[1].leaguePoints);
    });

    it('should return empty array for bronze tier', async () => {
      const toDemote = await determineDemotions('bronze_1');
      expect(toDemote).toEqual([]);
    });
  });

  describe('promoteRobot', () => {
    it('should move standing to next tier, assign new instance, and reset cyclesInTier', async () => {
      const { robot, standing } = await createRobotWithStanding({
        name: 'Promotion Test Robot',
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        cyclesInTier: 10,
        elo: 1300,
      });

      // promoteRobot takes the standing entity (returned from determinePromotions)
      await promoteRobot(standing as any);

      // Verify standings row was updated
      const updatedStanding = await prisma.standing.findFirst({
        where: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' },
      });
      expect(updatedStanding?.tier).toBe('silver');
      expect(updatedStanding?.leagueInstanceId).toMatch(/^silver_\d+$/);
      expect(updatedStanding?.cyclesInTier).toBe(0);
      // LP retained on promotion
      expect(updatedStanding?.leaguePoints).toBe(50);
    });

    it('should throw error when trying to promote from champion', async () => {
      const { standing } = await createRobotWithStanding({
        name: 'Champion Robot',
        tier: 'champion',
        leagueInstanceId: 'champion_1',
        cyclesInTier: 10,
        elo: 1800,
      });

      await expect(promoteRobot(standing as any)).rejects.toThrow();
    });
  });

  describe('demoteRobot', () => {
    it('should move standing to previous tier and reset cyclesInTier', async () => {
      const { robot, standing } = await createRobotWithStanding({
        name: 'Demotion Test Robot',
        tier: 'silver',
        leagueInstanceId: 'silver_1',
        cyclesInTier: 10,
        elo: 1100,
      });

      await demoteRobot(standing as any);

      const updatedStanding = await prisma.standing.findFirst({
        where: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' },
      });
      expect(updatedStanding?.tier).toBe('bronze');
      expect(updatedStanding?.leagueInstanceId).toMatch(/^bronze_\d+$/);
      expect(updatedStanding?.cyclesInTier).toBe(0);
      // LP retained on demotion
      expect(updatedStanding?.leaguePoints).toBe(5);
    });

    it('should throw error when trying to demote from bronze', async () => {
      const { standing } = await createRobotWithStanding({
        name: 'Bronze Robot',
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        cyclesInTier: 10,
        elo: 1000,
      });

      await expect(demoteRobot(standing as any)).rejects.toThrow();
    });
  });

  describe('rebalanceLeagues', () => {
    it('should process all tiers and return summary', async () => {
      // Create 20 bronze standings with enough LP for some promotions
      for (let i = 0; i < 20; i++) {
        await createRobotWithStanding({
          name: `Bronze ${i}`,
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          cyclesInTier: 10,
        });
      }

      const summary = await rebalanceLeagues();

      expect(summary.totalRobots).toBeGreaterThanOrEqual(20);
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
