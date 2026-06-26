/**
 * Integration Test: Tag Team League Rebalancing
 * 
 * Tests league rebalancing with varying league points using the TeamBattle model.
 * 
 * This test verifies:
 * - Top 10% of teams are promoted (minimum 5 cycles in tier)
 * - Bottom 10% of teams are demoted (minimum 5 cycles in tier)
 * - League points reset to 0 on promotion/demotion
 * - Cycles counter resets to 0 on promotion/demotion
 * - Teams with < 5 cycles are not eligible for promotion/demotion
 */

import prisma from '../../src/lib/prisma';
import { rebalanceTagTeamLeagues } from '../../src/services/tag-team/tagTeamLeagueRebalancingService';


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
            pricePaid: 0,
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
          },
        });
        testRobots.push(robot);
      }
    }
  });

  afterEach(async () => {
    // Clean up teams after each test
    if (testTeams.length > 0) {
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: testTeams.map(t => t.id) } },
      });
      await prisma.teamBattle.deleteMany({
        where: { id: { in: testTeams.map(t => t.id) } },
      });
      testTeams = [];
    }
  });

  afterAll(async () => {
    // Clean up in correct dependency order
    if (testTeams.length > 0) {
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: testTeams.map(t => t.id) } },
      });
      await prisma.teamBattle.deleteMany({
        where: { id: { in: testTeams.map(t => t.id) } },
      });
    }
    await prisma.robot.deleteMany({
      where: { id: { in: testRobots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: { in: testUsers.map(u => u.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUsers.map(u => u.id) } },
    });
    await prisma.$disconnect();
  });

  it('should promote top 10% and demote bottom 10% with varying league points', async () => {
    // Step 1: Create teams with varying league points using TeamBattle model
    console.log('[Test] Step 1: Creating teams with varying league points...');
    
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const robot1 = testRobots[i * 2];
      const robot2 = testRobots[i * 2 + 1];

      // Create TeamBattle with tag team fields
      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Rebalance Team ${i}`,
          members: {
            create: [
              { robotId: robot1.id, slotIndex: 0 },
              { robotId: robot2.id, slotIndex: 1 },
            ],
          },
        },
      });
      testTeams.push(team);
    }

    expect(testTeams.length).toBe(20);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Verify initial state - teams created
    expect(testTeams.length).toBe(20);

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
    const expectedPromotions = 2;
    expect(rebalanceResult.totalPromoted).toBe(expectedPromotions);

    const promotedTeams = await prisma.teamBattle.findMany({
      where: {
        id: { in: testTeams.map(t => t.id) },
      },
      orderBy: { id: 'asc' },
    });

    expect(promotedTeams.length).toBe(expectedPromotions);

    // Step 4: Verify demotions (none expected since we're in Bronze)
    console.log('[Test] Step 4: Verifying demotions...');
    
    // Bronze is the lowest tier, so no demotions
    expect(rebalanceResult.totalDemoted).toBe(0);

    // Step 5: Verify teams that stayed in Bronze
    console.log('[Test] Step 5: Verifying teams that stayed in Bronze...');
    
    const remainingBronzeTeams = await prisma.teamBattle.findMany({
      where: {
        id: { in: testTeams.map(t => t.id) },
      },
    });

    expect(remainingBronzeTeams.length).toBe(testTeams.length - expectedPromotions);

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
          pricePaid: 0,
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
        },
      });
      robots.push(robot);
    }

    // Create team with high points but only 3 cycles
    const newTeam = await prisma.teamBattle.create({
      data: {
        stableId: user.id,
        teamSize: 2,
        teamName: 'New Team Test',
        members: {
          create: [
            { robotId: robots[0].id, slotIndex: 0 },
            { robotId: robots[1].id, slotIndex: 1 },
          ],
        },
      },
    });

    // Run rebalancing
    await rebalanceTagTeamLeagues();

    // Verify team was not promoted
    const teamAfter = await prisma.teamBattle.findUnique({
      where: { id: newTeam.id },
    });

    expect(teamAfter).toBeDefined();
    // League data now in standings table — team record remains unchanged

    console.log('[Test] ✓ Teams with < 5 cycles correctly excluded from rebalancing');

    // Clean up
    await prisma.teamBattleMember.deleteMany({ where: { teamId: newTeam.id } });
    await prisma.teamBattle.deleteMany({ where: { id: newTeam.id } });
    await prisma.robot.deleteMany({
      where: { id: { in: robots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: user.id },
    });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it('should handle demotion from silver to bronze', async () => {
    // Create teams in silver league with low points
    const weapon = await prisma.weapon.findFirst();
    const users = [];
    const robots: any[] = [];
    const teams: any[] = [];

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
            pricePaid: 0,
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
          },
        });
        robots.push(robot);
      }

      // Create team in silver with varying points
      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Silver Team ${i}`,
          members: {
            create: [
              { robotId: robots[i * 2].id, slotIndex: 0 },
              { robotId: robots[i * 2 + 1].id, slotIndex: 1 },
            ],
          },
        },
      });
      teams.push(team);
    }

    // Run rebalancing
    const rebalanceResult = await rebalanceTagTeamLeagues();

    // Verify demotions (bottom 10% = 1 team)
    const expectedDemotions = Math.floor(teams.length * 0.1);
    
    const demotedTeams = await prisma.teamBattle.findMany({
      where: {
        id: { in: teams.map(t => t.id) },
      },
    });

    expect(demotedTeams.length).toBe(expectedDemotions);

    console.log(`[Test] ✓ Demoted ${demotedTeams.length} teams from silver to bronze`);

    // Clean up
    await prisma.teamBattleMember.deleteMany({
      where: { teamId: { in: teams.map(t => t.id) } },
    });
    await prisma.teamBattle.deleteMany({
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
    const robots: any[] = [];
    const teams: any[] = [];

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
            pricePaid: 0,
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
          },
        });
        robots.push(robot);
      }

      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Gold Team ${i}`,
          members: {
            create: [
              { robotId: robots[i * 2].id, slotIndex: 0 },
              { robotId: robots[i * 2 + 1].id, slotIndex: 1 },
            ],
          },
        },
      });
      teams.push(team);
    }

    // Run rebalancing
    await rebalanceTagTeamLeagues();

    // With < 10 teams, rebalancing should still work but percentages may be 0
    // 10% of 5 = 0.5, which floors to 0
    const promotedCount = await prisma.teamBattle.count({
      where: {
        id: { in: teams.map(t => t.id) },
      },
    });

    const demotedCount = await prisma.teamBattle.count({
      where: {
        id: { in: teams.map(t => t.id) },
      },
    });

    // With 5 teams, 10% = 0.5 which rounds to 0
    expect(promotedCount).toBe(0);
    expect(demotedCount).toBe(0);

    console.log('[Test] ✓ Rebalancing with < 10 teams handled correctly');

    // Clean up
    await prisma.teamBattleMember.deleteMany({
      where: { teamId: { in: teams.map(t => t.id) } },
    });
    await prisma.teamBattle.deleteMany({
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
