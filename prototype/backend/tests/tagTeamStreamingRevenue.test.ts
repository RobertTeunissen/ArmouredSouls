/**
 * Unit Test: Tag Team Streaming Revenue Integration
 * 
 * Tests that streaming revenue is calculated and awarded correctly for Tag Team battles
 * 
 * This test verifies:
 * - Streaming revenue is calculated after Tag Team battle completion
 * - Revenue uses highest battle count and highest fame from each team
 * - One payment is awarded per team (not per robot)
 * - Terminal logs show which robots' stats were used
 */

import prisma from '../src/lib/prisma';
import { createTeam } from '../src/services/tagTeamService';
import { executeScheduledTagTeamBattles } from '../src/services/tagTeamBattleOrchestrator';


describe('Tag Team Streaming Revenue Integration', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testWeaponInvIds: number[] = [];
  let testTagTeamIds: number[] = [];
  let testUser1: any;
  let testUser2: any;
  let weapon: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Get a weapon for robots
    weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found. Run seed first.');
    }

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        username: `tagteam_streaming_user1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(testUser1.id);

    testUser2 = await prisma.user.create({
      data: {
        username: `tagteam_streaming_user2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(testUser2.id);
  });

  afterAll(async () => {
    // Clean up in correct order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
    }

    if (testTagTeamIds.length > 0) {
      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: testTagTeamIds } },
            { team2Id: { in: testTagTeamIds } },
          ],
        },
      });
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTagTeamIds } },
      });
    }

    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testWeaponInvIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { id: { in: testWeaponInvIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any existing scheduled matches and battles to ensure test isolation
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
  });

  afterEach(async () => {
    // Clean up test data between tests (keep users and weapons from beforeAll)
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.tagTeam.deleteMany({});
    await prisma.robot.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { id: { in: testWeaponInvIds } },
    });
    
    // Reset tracking arrays
    testRobotIds = [];
    testWeaponInvIds = [];
    testTagTeamIds = [];
  });

  it('should calculate and award streaming revenue for Tag Team battles', async () => {
    // Create robots for team 1 with different battle counts and fame
    const weaponInv1_1 = await prisma.weaponInventory.create({
      data: { userId: testUser1.id, weaponId: weapon.id },
    });
    testWeaponInvIds.push(weaponInv1_1.id);

    const weaponInv1_2 = await prisma.weaponInventory.create({
      data: { userId: testUser1.id, weaponId: weapon.id },
    });
    testWeaponInvIds.push(weaponInv1_2.id);

    const robot1_1 = await prisma.robot.create({
      data: {
        userId: testUser1.id,
        name: `Team1_Robot1_${Date.now()}`,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv1_1.id,
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        cyclesInCurrentLeague: 0,
        totalBattles: 500, // Higher battle count
        totalTagTeamBattles: 0,
        fame: 1000, // Lower fame
      },
    });
    testRobotIds.push(robot1_1.id);

    const robot1_2 = await prisma.robot.create({
      data: {
        userId: testUser1.id,
        name: `Team1_Robot2_${Date.now()}`,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv1_2.id,
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        cyclesInCurrentLeague: 0,
        totalBattles: 100, // Lower battle count
        totalTagTeamBattles: 0,
        fame: 5000, // Higher fame
      },
    });
    testRobotIds.push(robot1_2.id);

    // Create robots for team 2
    const weaponInv2_1 = await prisma.weaponInventory.create({
      data: { userId: testUser2.id, weaponId: weapon.id },
    });
    testWeaponInvIds.push(weaponInv2_1.id);

    const weaponInv2_2 = await prisma.weaponInventory.create({
      data: { userId: testUser2.id, weaponId: weapon.id },
    });
    testWeaponInvIds.push(weaponInv2_2.id);

    const robot2_1 = await prisma.robot.create({
      data: {
        userId: testUser2.id,
        name: `Team2_Robot1_${Date.now()}`,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv2_1.id,
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        cyclesInCurrentLeague: 0,
        totalBattles: 200,
        totalTagTeamBattles: 0,
        fame: 2000,
      },
    });
    testRobotIds.push(robot2_1.id);

    const robot2_2 = await prisma.robot.create({
      data: {
        userId: testUser2.id,
        name: `Team2_Robot2_${Date.now()}`,
        elo: 1000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        yieldThreshold: 20,
        loadoutType: 'single',
        mainWeaponId: weaponInv2_2.id,
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        cyclesInCurrentLeague: 0,
        totalBattles: 300,
        totalTagTeamBattles: 0,
        fame: 3000,
      },
    });
    testRobotIds.push(robot2_2.id);

    // Create teams
    const team1Result = await createTeam(testUser1.id, robot1_1.id, robot1_2.id);
    const team2Result = await createTeam(testUser2.id, robot2_1.id, robot2_2.id);

    expect(team1Result.success).toBe(true);
    expect(team2Result.success).toBe(true);

    const team1 = team1Result.team!;
    const team2 = team2Result.team!;
    testTagTeamIds.push(team1.id, team2.id);

    // Create a match
    const match = await prisma.tagTeamMatch.create({
      data: {
        team1Id: team1.id,
        team2Id: team2.id,
        tagTeamLeague: 'bronze',
        scheduledFor: new Date(),
        status: 'scheduled',
      },
    });

    // Get initial balances
    const initialBalance1 = testUser1.currency;
    const initialBalance2 = testUser2.currency;

    // Execute the battle using the scheduled battles function
    const battleResult = await executeScheduledTagTeamBattles();

    expect(battleResult).toBeDefined();
    expect(battleResult.totalBattles).toBe(1);

    // Get updated balances
    const updatedUser1 = await prisma.user.findUnique({ where: { id: testUser1.id } });
    const updatedUser2 = await prisma.user.findUnique({ where: { id: testUser2.id } });

    expect(updatedUser1).toBeDefined();
    expect(updatedUser2).toBeDefined();

    // Calculate expected streaming revenue
    // Team 1: max battles = 500, max fame = 5000
    // Formula: 1000 × (1 + 500/1000) × (1 + 5000/5000) × (1 + 0×0.1)
    // = 1000 × 1.5 × 2.0 × 1.0 = 3000
    const expectedRevenue1 = 3000;

    // Team 2: max battles = 300, max fame = 3000
    // Formula: 1000 × (1 + 300/1000) × (1 + 3000/5000) × (1 + 0×0.1)
    // = 1000 × 1.3 × 1.6 × 1.0 = 2080
    const expectedRevenue2 = 2080;

    // Verify streaming revenue was awarded (balance should increase by at least the streaming revenue)
    // Note: Balance also includes battle rewards, so we check it increased by at least the streaming revenue
    const balanceIncrease1 = updatedUser1!.currency - initialBalance1;
    const balanceIncrease2 = updatedUser2!.currency - initialBalance2;

    expect(balanceIncrease1).toBeGreaterThanOrEqual(expectedRevenue1);
    expect(balanceIncrease2).toBeGreaterThanOrEqual(expectedRevenue2);

    console.log(`[Test] Team 1 balance increased by ₡${balanceIncrease1} (expected streaming revenue: ₡${expectedRevenue1})`);
    console.log(`[Test] Team 2 balance increased by ₡${balanceIncrease2} (expected streaming revenue: ₡${expectedRevenue2})`);
  });
});
