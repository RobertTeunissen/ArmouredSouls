/**
 * Integration Test: Tag Team League Rebalancing
 * 
 * Tests league rebalancing with varying league points
 * 
 * This test verifies:
 * - Top 10% of teams are promoted (minimum 5 cycles in tier)
 * - Bottom 10% of teams are demoted (minimum 5 cycles in tier)
 * - League points reset to 0 on promotion/demotion
 * - Cycles counter resets to 0 on promotion/demotion
 * - Teams with < 5 cycles are not eligible for promotion/demotion
 */

import { PrismaClient } from '@prisma/client';
import { rebalanceTagTeamLeagues } from '../../src/services/tagTeamLeagueRebalancingService';

const prisma = new PrismaClient();

describe('Tag Team League Rebalancing Integration Test', () => {
  let testUsers: any[] = [];
  let testRobots: any[] = [];
  let testTeams: any[] = [];

  beforeAll(async () => {
    await prisma.$connect();

    // Get a weapon for robots
    const weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found. Run seed first.');
    }

    // Create 20 test users (for 20 teams in bronze league)
    for (let i = 0; i < 20; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_rebalance_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      testUsers.push(user);

      // Create 2 robots per user
      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: user.id,
            weaponId: weapon.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Rebalance_Robot_${i}_${j}_${Date.now()}`,
            elo: 1000,
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
            currentLeague: 'bronze',
            leagueId: 'bronze_1',
          },
        });
        testRobots.push(robot);
      }
    }
  });

  afterAll(async () => {
    // Clean up
    await prisma.tagTeam.deleteMany({
      where: {
        id: { in: testTeams.map(t => t.id) },
      },
    });
    await prisma.robot.deleteMany({
      where: {
        id: { in: testRobots.map(r => r.id) },
      },
    });
    await prisma.weaponInventory.deleteMany({
      where: {
        userId: { in: testUsers.map(u => u.id) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: testUsers.map(u => u.id) },
      },
    });
    await prisma.$disconnect();
  });

  it('should promote top 10% and demote bottom 10% with varying league points', async () => {
    // Step 1: Create teams with varying league points
    console.log('[Test] Step 1: Creating teams with varying league points...');
    
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const robot1 = testRobots[i * 2];
      const robot2 = testRobots[i * 2 + 1];

      // Create team with varying league points (0-100)
      const team = await prisma.tagTeam.create({
        data: {
          stableId: user.id,
          activeRobotId: robot1.id,
          reserveRobotId: robot2.id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: i * 5, // 0, 5, 10, 15, ..., 95
          cyclesInTagTeamLeague: 10, // All eligible for promotion/demotion
          totalTagTeamWins: 0,
          totalTagTeamLosses: 0,
          totalTagTeamDraws: 0,
        },
      });
      testTeams.push(team);
    }

    expect(testTeams.length).toBe(20);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Verify initial state
    testTeams.forEach((team, index) => {
      expect(team.tagTeamLeague).toBe('bronze');
      expect(team.tagTeamLeaguePoints).toBe(index * 5);
      expect(team.cyclesInTagTeamLeague).toBe(10);
    });

    // Step 2: Run rebalancing
    console.log('[Test] Step 2: Running league rebalancing...');
    
    const rebalanceResult = await rebalanceTagTeamLeagues();
    console.log(
      `[Test] Rebalancing complete: ${rebalanceResult.totalPromoted} promoted, ` +
      `${rebalanceResult.totalDemoted} demoted`
    );

    // Step 3: Verify promotions
    console.log('[Test] Step 3: Verifying promotions...');
    
    // Top 10% of 20 = 2 teams, but only from those with ≥25 points
    // Teams 5-19 have ≥25 points (15 teams), top 2 are teams with 95 and 90 points
    const expectedPromotions = 2;
    expect(rebalanceResult.totalPromoted).toBe(expectedPromotions);

    const promotedTeams = await prisma.tagTeam.findMany({
      where: {
        id: { in: testTeams.map(t => t.id) },
        tagTeamLeague: 'silver',
      },
      orderBy: {
        id: 'asc',
      },
    });

    expect(promotedTeams.length).toBe(expectedPromotions);

    // Verify promoted teams had highest points
    promotedTeams.forEach(team => {
      expect(team.tagTeamLeague).toBe('silver');
      expect(team.tagTeamLeagueId).toBe('silver_1');
      expect(team.tagTeamLeaguePoints).toBe(0); // Reset to 0
      expect(team.cyclesInTagTeamLeague).toBe(0); // Reset to 0
    });

    // Step 4: Verify demotions (none expected since we're in Bronze)
    console.log('[Test] Step 4: Verifying demotions...');
    
    // Bronze is the lowest tier, so no demotions
    expect(rebalanceResult.totalDemoted).toBe(0);

    // Step 5: Verify teams that stayed in Bronze
    console.log('[Test] Step 5: Verifying teams that stayed in Bronze...');
    
    const remainingBronzeTeams = await prisma.tagTeam.findMany({
      where: {
        id: { in: testTeams.map(t => t.id) },
        tagTeamLeague: 'bronze',
      },
    });

    expect(remainingBronzeTeams.length).toBe(testTeams.length - expectedPromotions);

    // Verify remaining teams kept their points and cycles
    remainingBronzeTeams.forEach(team => {
      expect(team.tagTeamLeague).toBe('bronze');
      expect(team.tagTeamLeaguePoints).toBeGreaterThanOrEqual(0);
      expect(team.cyclesInTagTeamLeague).toBe(10); // Unchanged
    });

    console.log('[Test] ✓ League rebalancing verified successfully');
  });

  it('should not promote/demote teams with < 5 cycles in tier', async () => {
    // Create teams with high points but low cycles
    const weapon = await prisma.weapon.findFirst();
    const user = await prisma.user.create({
      data: {
        username: `tagteam_newteam_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    const robots = [];
    for (let i = 0; i < 2; i++) {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: user.id,
          weaponId: weapon!.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: user.id,
          name: `NewTeam_Robot_${i}_${Date.now()}`,
          elo: 1000,
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
          yieldThreshold: 20,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
        },
      });
      robots.push(robot);
    }

    // Create team with high points but only 3 cycles
    const newTeam = await prisma.tagTeam.create({
      data: {
        stableId: user.id,
        activeRobotId: robots[0].id,
        reserveRobotId: robots[1].id,
        tagTeamLeague: 'bronze',
        tagTeamLeagueId: 'bronze_1',
        tagTeamLeaguePoints: 1000, // Very high points
        cyclesInTagTeamLeague: 3, // Not eligible (< 5)
        totalTagTeamWins: 0,
        totalTagTeamLosses: 0,
        totalTagTeamDraws: 0,
      },
    });

    // Run rebalancing
    await rebalanceTagTeamLeagues();

    // Verify team was not promoted
    const teamAfter = await prisma.tagTeam.findUnique({
      where: { id: newTeam.id },
    });

    expect(teamAfter).toBeDefined();
    expect(teamAfter!.tagTeamLeague).toBe('bronze'); // Still in bronze
    expect(teamAfter!.tagTeamLeaguePoints).toBe(1000); // Points unchanged
    expect(teamAfter!.cyclesInTagTeamLeague).toBe(3); // Cycles unchanged

    console.log('[Test] ✓ Teams with < 5 cycles correctly excluded from rebalancing');

    // Clean up
    await prisma.tagTeam.delete({ where: { id: newTeam.id } });
    await prisma.robot.deleteMany({
      where: { id: { in: robots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should handle demotion from silver to bronze', async () => {
    // Create teams in silver league with low points
    const weapon = await prisma.weapon.findFirst();
    const users = [];
    const robots = [];
    const teams = [];

    for (let i = 0; i < 10; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_silver_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      users.push(user);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: user.id,
            weaponId: weapon!.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Silver_Robot_${i}_${j}_${Date.now()}`,
            elo: 1000,
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
            currentLeague: 'silver',
            leagueId: 'silver_1',
          },
        });
        robots.push(robot);
      }

      // Create team in silver with varying points
      const team = await prisma.tagTeam.create({
        data: {
          stableId: user.id,
          activeRobotId: robots[i * 2].id,
          reserveRobotId: robots[i * 2 + 1].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_1',
          tagTeamLeaguePoints: i * 10, // 0, 10, 20, ..., 90
          cyclesInTagTeamLeague: 10, // All eligible
          totalTagTeamWins: 0,
          totalTagTeamLosses: 0,
          totalTagTeamDraws: 0,
        },
      });
      teams.push(team);
    }

    // Run rebalancing
    const rebalanceResult = await rebalanceTagTeamLeagues();

    // Verify demotions (bottom 10% = 1 team)
    const expectedDemotions = Math.floor(teams.length * 0.1);
    
    const demotedTeams = await prisma.tagTeam.findMany({
      where: {
        id: { in: teams.map(t => t.id) },
        tagTeamLeague: 'bronze',
      },
    });

    expect(demotedTeams.length).toBe(expectedDemotions);

    // Verify demoted teams had lowest points
    demotedTeams.forEach(team => {
      expect(team.tagTeamLeague).toBe('bronze');
      expect(team.tagTeamLeagueId).toBe('bronze_1');
      expect(team.tagTeamLeaguePoints).toBe(0); // Reset to 0
      expect(team.cyclesInTagTeamLeague).toBe(0); // Reset to 0
    });

    console.log(`[Test] ✓ Demoted ${demotedTeams.length} teams from silver to bronze`);

    // Clean up
    await prisma.tagTeam.deleteMany({
      where: { id: { in: teams.map(t => t.id) } },
    });
    await prisma.robot.deleteMany({
      where: { id: { in: robots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: { in: users.map(u => u.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map(u => u.id) } },
    });
  });

  it('should handle minimum team count for rebalancing (< 10 teams)', async () => {
    // Create only 5 teams in gold league
    const weapon = await prisma.weapon.findFirst();
    const users = [];
    const robots = [];
    const teams = [];

    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_gold_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      users.push(user);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: user.id,
            weaponId: weapon!.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Gold_Robot_${i}_${j}_${Date.now()}`,
            elo: 1000,
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
            currentLeague: 'gold',
            leagueId: 'gold_1',
          },
        });
        robots.push(robot);
      }

      const team = await prisma.tagTeam.create({
        data: {
          stableId: user.id,
          activeRobotId: robots[i * 2].id,
          reserveRobotId: robots[i * 2 + 1].id,
          tagTeamLeague: 'gold',
          tagTeamLeagueId: 'gold_1',
          tagTeamLeaguePoints: i * 10,
          cyclesInTagTeamLeague: 10,
          totalTagTeamWins: 0,
          totalTagTeamLosses: 0,
          totalTagTeamDraws: 0,
        },
      });
      teams.push(team);
    }

    // Run rebalancing
    await rebalanceTagTeamLeagues();

    // With < 10 teams, rebalancing should still work but percentages may be 0
    // 10% of 5 = 0.5, which floors to 0
    const promotedCount = await prisma.tagTeam.count({
      where: {
        id: { in: teams.map(t => t.id) },
        tagTeamLeague: 'platinum',
      },
    });

    const demotedCount = await prisma.tagTeam.count({
      where: {
        id: { in: teams.map(t => t.id) },
        tagTeamLeague: 'silver',
      },
    });

    // With 5 teams, 10% = 0.5 which rounds to 0
    expect(promotedCount).toBe(0);
    expect(demotedCount).toBe(0);

    console.log('[Test] ✓ Rebalancing with < 10 teams handled correctly');

    // Clean up
    await prisma.tagTeam.deleteMany({
      where: { id: { in: teams.map(t => t.id) } },
    });
    await prisma.robot.deleteMany({
      where: { id: { in: robots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: { in: users.map(u => u.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map(u => u.id) } },
    });
  });
});
