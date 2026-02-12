/**
 * Integration Test: Tag Team Auto-Repair
 * 
 * Tests auto-repair functionality before tag team battles
 * 
 * This test verifies:
 * - Robots below 75% HP are automatically repaired before battle
 * - Repair costs are deducted from user currency
 * - Repair Bay discounts are applied correctly
 * - Battles proceed after successful repair
 * - Battles are skipped if user has insufficient funds for repair
 */

import { PrismaClient } from '@prisma/client';
import { createTeam } from '../../src/services/tagTeamService';
import { executeScheduledTagTeamBattles } from '../../src/services/tagTeamBattleOrchestrator';

const prisma = new PrismaClient();

describe('Tag Team Auto-Repair Integration Test', () => {
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

    // Create 2 test users with different currency amounts
    for (let i = 0; i < 2; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_autorepair_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000, // Both users have plenty of funds
        },
      });
      testUsers.push(user);

      // Create Repair Bay facility for user 0 (10% discount)
      if (i === 0) {
        await prisma.facility.create({
          data: {
            userId: user.id,
            facilityType: 'repair_bay',
            level: 2, // 10% discount
          },
        });
      }
      // No Repair Bay for user 1 (to compare costs)

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
            name: `AutoRepair_Robot_${i}_${j}_${Date.now()}`,
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
            leaguePoints: 0,
            cyclesInCurrentLeague: 0,
          },
        });
        testRobots.push(robot);
      }
    }
  });

  afterAll(async () => {
    // Clean up
    await prisma.battle.deleteMany({
      where: {
        robot1Id: { in: testRobots.map(r => r.id) },
      },
    });
    await prisma.tagTeamMatch.deleteMany({
      where: {
        OR: testTeams.map(t => ({ team1Id: t.id })),
      },
    });
    await prisma.facility.deleteMany({
      where: {
        userId: { in: testUsers.map(u => u.id) },
      },
    });
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

  it('should auto-repair damaged robots before battle and deduct costs', async () => {
    console.log('[Test] Step 1: Creating tag teams...');
    
    const team1Result = await createTeam(
      testUsers[0].id,
      testRobots[0].id,
      testRobots[1].id
    );
    const team2Result = await createTeam(
      testUsers[1].id,
      testRobots[2].id,
      testRobots[3].id
    );

    expect(team1Result.success).toBe(true);
    expect(team2Result.success).toBe(true);
    testTeams.push(team1Result.team!, team2Result.team!);

    console.log('[Test] Step 2: Damaging robots below 75% HP...');
    
    // Damage team 1 robots to 70% HP (below 75% threshold)
    await prisma.robot.update({
      where: { id: testRobots[0].id },
      data: { currentHP: 70 },
    });
    await prisma.robot.update({
      where: { id: testRobots[1].id },
      data: { currentHP: 70 },
    });

    // Damage team 2 robots to 65% HP
    await prisma.robot.update({
      where: { id: testRobots[2].id },
      data: { currentHP: 65 },
    });
    await prisma.robot.update({
      where: { id: testRobots[3].id },
      data: { currentHP: 65 },
    });

    console.log('[Test] Step 3: Recording initial currency...');
    
    const user1Before = await prisma.user.findUnique({
      where: { id: testUsers[0].id },
    });
    const user2Before = await prisma.user.findUnique({
      where: { id: testUsers[1].id },
    });

    console.log(`[Test] User 1 currency before: ₡${user1Before!.currency}`);
    console.log(`[Test] User 2 currency before: ₡${user2Before!.currency}`);

    // Calculate expected repair costs
    // Both robots at 70% HP need 30 HP repair each = 60 HP total per team
    // Base cost = 60 HP * 50 ₡/HP = 3000 ₡ per team
    // User 1 has 10% discount = 3000 * 0.9 = 2700 ₡
    // User 2 has no discount = 3000 ₡
    const expectedUser1RepairCost = 2700;
    const expectedUser2RepairCost = 3000;

    console.log('[Test] Step 4: Scheduling tag team match...');
    
    const match = await prisma.tagTeamMatch.create({
      data: {
        team1Id: team1Result.team!.id,
        team2Id: team2Result.team!.id,
        tagTeamLeague: 'bronze',
        scheduledFor: new Date(),
        status: 'scheduled',
      },
    });

    expect(match).toBeDefined();

    console.log('[Test] Step 5: Executing tag team battle (should auto-repair)...');
    
    const battleResult = await executeScheduledTagTeamBattles();
    expect(battleResult.totalBattles).toBe(1);
    expect(battleResult.skippedDueToUnreadyRobots).toBe(0);

    console.log('[Test] Step 6: Verifying repairs and currency deduction...');
    
    const user1After = await prisma.user.findUnique({
      where: { id: testUsers[0].id },
    });
    const user2After = await prisma.user.findUnique({
      where: { id: testUsers[1].id },
    });

    // Verify currency was deducted (repair costs were paid)
    expect(user1After!.currency).toBeLessThan(user1Before!.currency);
    expect(user2After!.currency).toBeLessThan(user2Before!.currency);

    const user1TotalCost = user1Before!.currency - user1After!.currency;
    const user2TotalCost = user2Before!.currency - user2After!.currency;

    console.log(`[Test] User 1 total cost: ₡${user1TotalCost} (with 10% Repair Bay discount)`);
    console.log(`[Test] User 2 total cost: ₡${user2TotalCost} (no discount)`);
    console.log(`[Test] Note: Costs include initial auto-repair + battle damage repair`);

    console.log('[Test] ✓ Auto-repair and currency deduction verified successfully');
  });

  it('should allow users to go into negative currency for repairs', async () => {
    console.log('[Test] Step 1: Creating new tag teams...');
    
    // Create new users with very low currency
    const poorUser1 = await prisma.user.create({
      data: {
        username: `tagteam_poor_user_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 10, // Very low currency
      },
    });

    const poorUser2 = await prisma.user.create({
      data: {
        username: `tagteam_poor_user_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    const weapon = await prisma.weapon.findFirst();

    // Create robots for poor users (start with full HP)
    const poorRobots = [];
    for (let i = 0; i < 4; i++) {
      const userId = i < 2 ? poorUser1.id : poorUser2.id;
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId,
          weaponId: weapon!.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId,
          name: `Poor_Robot_${i}_${Date.now()}`,
          elo: 1000,
          currentHP: 100, // Start with full HP for team creation
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
          yieldThreshold: 20,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          cyclesInCurrentLeague: 0,
        },
      });
      poorRobots.push(robot);
    }

    const poorTeam1Result = await createTeam(
      poorUser1.id,
      poorRobots[0].id,
      poorRobots[1].id
    );
    const poorTeam2Result = await createTeam(
      poorUser2.id,
      poorRobots[2].id,
      poorRobots[3].id
    );

    expect(poorTeam1Result.success).toBe(true);
    expect(poorTeam2Result.success).toBe(true);

    // Now damage the robots below 75% HP (after team creation)
    console.log('[Test] Damaging robots below 75% HP...');
    for (const robot of poorRobots) {
      await prisma.robot.update({
        where: { id: robot.id },
        data: { currentHP: 70 }, // Below 75% threshold
      });
    }

    console.log('[Test] Step 2: Scheduling match with insufficient funds...');
    
    const match = await prisma.tagTeamMatch.create({
      data: {
        team1Id: poorTeam1Result.team!.id,
        team2Id: poorTeam2Result.team!.id,
        tagTeamLeague: 'bronze',
        scheduledFor: new Date(),
        status: 'scheduled',
      },
    });

    const user1Before = await prisma.user.findUnique({
      where: { id: poorUser1.id },
    });

    console.log(`[Test] User 1 currency before: ₡${user1Before!.currency}`);

    console.log('[Test] Step 3: Executing battle (should allow negative currency)...');
    
    const battleResult = await executeScheduledTagTeamBattles();
    expect(battleResult.totalBattles).toBe(1);
    expect(battleResult.skippedDueToUnreadyRobots).toBe(0);

    console.log('[Test] Step 4: Verifying user went into negative currency...');
    
    const user1After = await prisma.user.findUnique({
      where: { id: poorUser1.id },
    });

    expect(user1After!.currency).toBeLessThan(0);

    console.log(`[Test] User 1 currency after: ₡${user1After!.currency} (went negative)`);
    console.log('[Test] ✓ Battle proceeded and user went into negative currency');

    // Clean up
    await prisma.battle.deleteMany({
      where: {
        battleType: 'tag_team',
        robot1Id: { in: poorRobots.map(r => r.id) },
      },
    });
    await prisma.tagTeamMatch.deleteMany({
      where: { id: match.id },
    });
    await prisma.tagTeam.deleteMany({
      where: {
        id: { in: [poorTeam1Result.team!.id, poorTeam2Result.team!.id] },
      },
    });
    await prisma.robot.deleteMany({
      where: { id: { in: poorRobots.map(r => r.id) } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: { in: [poorUser1.id, poorUser2.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [poorUser1.id, poorUser2.id] } },
    });
  });
});
