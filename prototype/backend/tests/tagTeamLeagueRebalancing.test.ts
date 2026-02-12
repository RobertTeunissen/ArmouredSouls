import { PrismaClient } from '@prisma/client';
import {
  determinePromotions,
  determineDemotions,
  promoteTeam,
  demoteTeam,
  rebalanceTagTeamLeagues,
  TAG_TEAM_LEAGUE_TIERS,
} from '../src/services/tagTeamLeagueRebalancingService';

const prisma = new PrismaClient();

describe('Tag Team League Rebalancing', () => {
  let testStableId: number;
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];

  beforeEach(async () => {
    // Create a test stable
    const stable = await prisma.user.create({
      data: {
        username: `test_stable_${Date.now()}`,
        passwordHash: 'test',
        currency: 10000,
      },
    });
    testStableId = stable.id;
  });

  afterEach(async () => {
    // Clean up test data in correct order
    if (testTeamIds.length > 0) {
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }
    if (testRobotIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { userId: testStableId },
      });
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }
    if (testStableId) {
      await prisma.user.delete({
        where: { id: testStableId },
      });
    }

    testTeamIds = [];
    testRobotIds = [];
  });

  /**
   * Helper function to create a test robot
   */
  async function createTestRobot(elo: number = 1000) {
    // Get a weapon for the robot
    const weapon = await prisma.weapon.findFirst();
    const weaponInv = await prisma.weaponInventory.create({
      data: { userId: testStableId, weaponId: weapon!.id },
    });

    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}_${Math.random()}`,
        userId: testStableId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 30,
        elo,
        hullIntegrity: 10.0,
        loadoutType: 'single',
        mainWeaponId: weaponInv.id,
      },
    });
    testRobotIds.push(robot.id);
    return robot;
  }

  /**
   * Helper function to create a test tag team
   */
  async function createTestTeam(
    league: string = 'bronze',
    leaguePoints: number = 0,
    cyclesInLeague: number = 0
  ) {
    const robot1 = await createTestRobot();
    const robot2 = await createTestRobot();

    const team = await prisma.tagTeam.create({
      data: {
        stableId: testStableId,
        activeRobotId: robot1.id,
        reserveRobotId: robot2.id,
        tagTeamLeague: league,
        tagTeamLeagueId: `${league}_1`,
        tagTeamLeaguePoints: leaguePoints,
        cyclesInTagTeamLeague: cyclesInLeague,
      },
    });
    testTeamIds.push(team.id);
    return team;
  }

  describe('determinePromotions', () => {
    it('should return empty array for champion tier', async () => {
      const promotions = await determinePromotions('champion');
      expect(promotions).toEqual([]);
    });

    it('should return empty array when fewer than 10 teams', async () => {
      // Create 5 teams in bronze with 5+ cycles
      for (let i = 0; i < 5; i++) {
        await createTestTeam('bronze', 10 + i, 5);
      }

      const promotions = await determinePromotions('bronze');
      expect(promotions).toEqual([]);
    });

    it('should return empty array when no teams have 5+ cycles', async () => {
      // Create 15 teams in bronze with < 5 cycles
      for (let i = 0; i < 15; i++) {
        await createTestTeam('bronze', 10 + i, 3);
      }

      const promotions = await determinePromotions('bronze');
      expect(promotions).toEqual([]);
    });

    it('should promote top 10% of eligible teams', async () => {
      // Create 20 teams in bronze with 5+ cycles
      for (let i = 0; i < 20; i++) {
        await createTestTeam('bronze', i * 10, 5);
      }

      const promotions = await determinePromotions('bronze');
      
      // Top 10% of 20 = 2 teams
      expect(promotions).toHaveLength(2);
      
      // Should be the teams with highest league points
      expect(promotions[0].tagTeamLeaguePoints).toBe(190);
      expect(promotions[1].tagTeamLeaguePoints).toBe(180);
    });

    it('should exclude teams in excludeTeamIds set', async () => {
      // Create 20 teams in bronze with 5+ cycles
      const teams = [];
      for (let i = 0; i < 20; i++) {
        const team = await createTestTeam('bronze', i * 10, 5);
        teams.push(team);
      }

      // Exclude the top 2 teams
      const excludeSet = new Set([teams[19].id, teams[18].id]);
      const promotions = await determinePromotions('bronze', excludeSet);
      
      // With 18 remaining teams, 10% = 1.8, rounds down to 1
      expect(promotions).toHaveLength(1);
      expect(promotions[0].tagTeamLeaguePoints).toBe(170);
    });
  });

  describe('determineDemotions', () => {
    it('should return empty array for bronze tier', async () => {
      const demotions = await determineDemotions('bronze');
      expect(demotions).toEqual([]);
    });

    it('should return empty array when fewer than 10 teams', async () => {
      // Create 5 teams in silver with 5+ cycles
      for (let i = 0; i < 5; i++) {
        await createTestTeam('silver', 10 + i, 5);
      }

      const demotions = await determineDemotions('silver');
      expect(demotions).toEqual([]);
    });

    it('should return empty array when no teams have 5+ cycles', async () => {
      // Create 15 teams in silver with < 5 cycles
      for (let i = 0; i < 15; i++) {
        await createTestTeam('silver', 10 + i, 3);
      }

      const demotions = await determineDemotions('silver');
      expect(demotions).toEqual([]);
    });

    it('should demote bottom 10% of eligible teams', async () => {
      // Create 20 teams in silver with 5+ cycles
      for (let i = 0; i < 20; i++) {
        await createTestTeam('silver', i * 10, 5);
      }

      const demotions = await determineDemotions('silver');
      
      // Bottom 10% of 20 = 2 teams
      expect(demotions).toHaveLength(2);
      
      // Should be the teams with lowest league points
      expect(demotions[0].tagTeamLeaguePoints).toBe(0);
      expect(demotions[1].tagTeamLeaguePoints).toBe(10);
    });

    it('should exclude teams in excludeTeamIds set', async () => {
      // Create 20 teams in silver with 5+ cycles
      const teams = [];
      for (let i = 0; i < 20; i++) {
        const team = await createTestTeam('silver', i * 10, 5);
        teams.push(team);
      }

      // Exclude the bottom 2 teams
      const excludeSet = new Set([teams[0].id, teams[1].id]);
      const demotions = await determineDemotions('silver', excludeSet);
      
      // With 18 remaining teams, 10% = 1.8, rounds down to 1
      expect(demotions).toHaveLength(1);
      expect(demotions[0].tagTeamLeaguePoints).toBe(20);
    });
  });

  describe('promoteTeam', () => {
    it('should promote team from bronze to silver', async () => {
      const team = await createTestTeam('bronze', 100, 5);

      await promoteTeam(team);

      const updatedTeam = await prisma.tagTeam.findUnique({
        where: { id: team.id },
      });

      expect(updatedTeam?.tagTeamLeague).toBe('silver');
      expect(updatedTeam?.tagTeamLeagueId).toBe('silver_1');
      expect(updatedTeam?.tagTeamLeaguePoints).toBe(0);
      expect(updatedTeam?.cyclesInTagTeamLeague).toBe(0);
    });

    it('should promote team from silver to gold', async () => {
      const team = await createTestTeam('silver', 100, 5);

      await promoteTeam(team);

      const updatedTeam = await prisma.tagTeam.findUnique({
        where: { id: team.id },
      });

      expect(updatedTeam?.tagTeamLeague).toBe('gold');
      expect(updatedTeam?.tagTeamLeaguePoints).toBe(0);
      expect(updatedTeam?.cyclesInTagTeamLeague).toBe(0);
    });

    it('should throw error when promoting from champion tier', async () => {
      const team = await createTestTeam('champion', 100, 5);

      await expect(promoteTeam(team)).rejects.toThrow(
        'Cannot promote team'
      );
    });
  });

  describe('demoteTeam', () => {
    it('should demote team from silver to bronze', async () => {
      const team = await createTestTeam('silver', 100, 5);

      await demoteTeam(team);

      const updatedTeam = await prisma.tagTeam.findUnique({
        where: { id: team.id },
      });

      expect(updatedTeam?.tagTeamLeague).toBe('bronze');
      expect(updatedTeam?.tagTeamLeagueId).toBe('bronze_1');
      expect(updatedTeam?.tagTeamLeaguePoints).toBe(0);
      expect(updatedTeam?.cyclesInTagTeamLeague).toBe(0);
    });

    it('should demote team from gold to silver', async () => {
      const team = await createTestTeam('gold', 100, 5);

      await demoteTeam(team);

      const updatedTeam = await prisma.tagTeam.findUnique({
        where: { id: team.id },
      });

      expect(updatedTeam?.tagTeamLeague).toBe('silver');
      expect(updatedTeam?.tagTeamLeaguePoints).toBe(0);
      expect(updatedTeam?.cyclesInTagTeamLeague).toBe(0);
    });

    it('should throw error when demoting from bronze tier', async () => {
      const team = await createTestTeam('bronze', 100, 5);

      await expect(demoteTeam(team)).rejects.toThrow(
        'Cannot demote team'
      );
    });
  });

  describe('rebalanceTagTeamLeagues', () => {
    beforeEach(async () => {
      // Clean up ALL teams before these tests since they count total teams
      await prisma.tagTeam.deleteMany({});
    });

    it('should handle empty league system', async () => {
      const summary = await rebalanceTagTeamLeagues();

      expect(summary.totalTeams).toBe(0);
      expect(summary.totalPromoted).toBe(0);
      expect(summary.totalDemoted).toBe(0);
      expect(summary.tierSummaries).toHaveLength(6); // 6 tiers
    });

    it('should promote and demote teams across multiple tiers', async () => {
      // Create 20 teams in bronze (top 2 should be promoted)
      for (let i = 0; i < 20; i++) {
        await createTestTeam('bronze', i * 10, 5);
      }

      // Create 20 teams in silver (top 2 promoted, bottom 2 demoted)
      for (let i = 0; i < 20; i++) {
        await createTestTeam('silver', i * 10, 5);
      }

      const summary = await rebalanceTagTeamLeagues();

      expect(summary.totalTeams).toBe(40);
      expect(summary.totalPromoted).toBe(4); // 2 from bronze, 2 from silver
      expect(summary.totalDemoted).toBe(2); // 2 from silver

      // Check bronze tier summary
      const bronzeSummary = summary.tierSummaries.find(s => s.tier === 'bronze');
      expect(bronzeSummary?.promoted).toBe(2);
      expect(bronzeSummary?.demoted).toBe(0); // Bronze can't demote

      // Check silver tier summary
      const silverSummary = summary.tierSummaries.find(s => s.tier === 'silver');
      expect(silverSummary?.promoted).toBe(2);
      expect(silverSummary?.demoted).toBe(2);
    });

    it('should skip tiers with insufficient teams', async () => {
      // Create only 5 teams in bronze (not enough for rebalancing)
      for (let i = 0; i < 5; i++) {
        await createTestTeam('bronze', i * 10, 5);
      }

      const summary = await rebalanceTagTeamLeagues();

      expect(summary.totalPromoted).toBe(0);
      expect(summary.totalDemoted).toBe(0);

      const bronzeSummary = summary.tierSummaries.find(s => s.tier === 'bronze');
      expect(bronzeSummary?.eligibleTeams).toBe(5);
      expect(bronzeSummary?.promoted).toBe(0);
    });

    it('should skip teams without 5+ cycles', async () => {
      // Create 20 teams in bronze but only 10 with 5+ cycles
      for (let i = 0; i < 10; i++) {
        await createTestTeam('bronze', i * 10, 5); // Eligible
      }
      for (let i = 0; i < 10; i++) {
        await createTestTeam('bronze', (i + 10) * 10, 3); // Not eligible
      }

      const summary = await rebalanceTagTeamLeagues();

      // Only 10 eligible teams, so 1 should be promoted (10% of 10)
      expect(summary.totalPromoted).toBe(1);

      const bronzeSummary = summary.tierSummaries.find(s => s.tier === 'bronze');
      expect(bronzeSummary?.eligibleTeams).toBe(10);
      expect(bronzeSummary?.promoted).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 10 teams (minimum for rebalancing)', async () => {
      // Create exactly 10 teams in bronze with 5+ cycles
      for (let i = 0; i < 10; i++) {
        await createTestTeam('bronze', i * 10, 5);
      }

      const promotions = await determinePromotions('bronze');
      
      // 10% of 10 = 1 team
      expect(promotions).toHaveLength(1);
      expect(promotions[0].tagTeamLeaguePoints).toBe(90);
    });

    it('should handle 11 teams (10% rounds down to 1)', async () => {
      // Create 11 teams in bronze with 5+ cycles
      for (let i = 0; i < 11; i++) {
        await createTestTeam('bronze', i * 10, 5);
      }

      const promotions = await determinePromotions('bronze');
      
      // 10% of 11 = 1.1, rounds down to 1
      expect(promotions).toHaveLength(1);
    });

    it('should handle teams with same league points (tiebreaker)', async () => {
      // Create 20 teams with same league points
      for (let i = 0; i < 20; i++) {
        await createTestTeam('bronze', 100, 5);
      }

      const promotions = await determinePromotions('bronze');
      
      // Should still get 2 teams (10% of 20)
      expect(promotions).toHaveLength(2);
      
      // All have same points, so tiebreaker is ID (ascending)
      expect(promotions[0].tagTeamLeaguePoints).toBe(100);
      expect(promotions[1].tagTeamLeaguePoints).toBe(100);
    });
  });
});
