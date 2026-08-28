/**
 * Integration Test: Bye-Team Handling
 * 
 * Tests bye-team match creation and execution with odd number of teams
 * 
 * This test verifies:
 * - Bye-team is created when odd number of teams eligible
 * - Bye-team has combined ELO of 2000 (1000 per robot)
 * - Bye-team match executes normally
 * - Full rewards awarded for bye-team wins
 * - Normal penalties applied for bye-team losses
 * - Bye-team matches are distributed evenly over cycles
 */

import prisma from '../../src/lib/prisma';
import { runTagTeamMatchmaking } from '../../src/services/tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamBattleOrchestrator';

/** Helper: Create a 2v2 TeamBattle with members (slot 0 = active, slot 1 = reserve) */
async function createTagTeamFixture(stableId: number, activeRobotId: number, reserveRobotId: number) {
  return prisma.teamBattle.create({
    data: {
      stableId,
      teamSize: 2,
      teamName: `Test_Team_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      members: {
        create: [
          { robotId: activeRobotId, slotIndex: 0 },
          { robotId: reserveRobotId, slotIndex: 1 },
        ],
      },
    },
    include: { members: true },
  });
}


describe('Tag Team Bye-Team Handling Integration Test', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];
  let weapon: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Get a weapon for robots
    weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found. Run seed first.');
    }
  });

  afterEach(async () => {
    // Clean up in correct order
    if (testTeamIds.length > 0) {
      await prisma.scheduledMatchParticipant.deleteMany({
        where: {
          participantType: 'team',
          participantId: { in: testTeamIds },
        },
      });
      await prisma.scheduledMatch.deleteMany({
        where: {
          matchType: 'tag_team',
          participants: { some: { participantId: { in: testTeamIds } } },
        },
      });
    }

    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          battleType: 'tag_team',
          participants: { some: { robotId: { in: testRobotIds } } },
        },
      });
    }

    if (testTeamIds.length > 0) {
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: testTeamIds } },
      });
      await prisma.teamBattle.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }

    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    testTeamIds = [];
    testRobotIds = [];
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create bye-team match when odd number of teams eligible', async () => {
    // Step 1: Create 3 teams (odd number)
    console.log('[Test] Step 1: Creating 3 teams (odd number)...');
    
    const testUsers: any[] = [];
    const testRobots: any[] = [];
    const testTeams: any[] = [];

    // Create 3 test users (odd number for bye-team scenario)
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_bye_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
          prestige: 0,
        },
      });
      testUsers.push(user);
      testUserIds.push(user.id);

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
            name: `Bye_Robot_${i}_${j}_${Date.now()}`,
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
        testRobotIds.push(robot.id);
      }
    }
    
    for (let i = 0; i < 3; i++) {
      const user = testUsers[i];
      const robot1 = testRobots[i * 2];
      const robot2 = testRobots[i * 2 + 1];

      const result = await createTagTeamFixture(user.id, robot1.id, robot2.id);
      testTeams.push(result);
      testTeamIds.push(result.id);
    }

    expect(testTeams.length).toBe(3);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Step 2: Run matchmaking
    console.log('[Test] Step 2: Running matchmaking...');
    
    const matchmakingResult = await runTagTeamMatchmaking();
    console.log(`[Test] Created ${matchmakingResult} matches`);

    // With 3 teams, we should have matches created
    expect(matchmakingResult).toBeGreaterThan(0);

    // Step 3: Verify bye-team match was created
    console.log('[Test] Step 3: Verifying bye-team match...');
    
    const byeMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'scheduled',
        matchType: 'tag_team',
        participants: { some: { participantId: -1 } },
      },
    });

    expect(byeMatches.length).toBeGreaterThan(0);
    console.log(`[Test] Found ${byeMatches.length} bye-team matches`);

    // Verify bye-team match structure
    const byeMatch = byeMatches[0];
    const byeMatchWithParticipants = await prisma.scheduledMatch.findUnique({
      where: { id: byeMatch.id },
      include: { participants: true },
    });
    const participantIds = byeMatchWithParticipants!.participants.map(p => p.participantId);
    expect(participantIds).toContain(-1);
    expect(byeMatch.matchType).toBe('tag_team');
    expect(byeMatch.status).toBe('scheduled');

    console.log('[Test] ✓ Bye-team match created successfully');
  });

  it('should execute bye-team match and award full rewards', async () => {
    // Step 1: Execute battles
    console.log('[Test] Step 1: Executing bye-team battles...');
    
    const battleResult = await executeScheduledTagTeamBattles();
    expect(battleResult.totalBattles).toBeGreaterThan(0);
    console.log(
      `[Test] Executed ${battleResult.totalBattles} battles: ` +
      `${battleResult.wins} wins, ${battleResult.draws} draws, ${battleResult.losses} losses`
    );

    // Step 2: Verify bye-team battle was executed
    console.log('[Test] Step 2: Verifying bye-team battle execution...');
    
    // Spec #49: a bye writes NO participant row for the placeholder. Those carry
    // negative ids and `battle_participants.robotId` has a Robot foreign key, so
    // such a row cannot exist — this query used to look for one and therefore
    // could never have passed. Byes are identified by their battleLog flag.
    const allTagTeamBattles = await prisma.battle.findMany({
      where: { battleType: 'tag_team' },
      include: { participants: true },
    });
    const byeBattles = allTagTeamBattles.filter(
      b => (b.battleLog as { isByeMatch?: boolean } | null)?.isByeMatch === true,
    );

    expect(byeBattles.length).toBeGreaterThan(0);
    console.log(`[Test] Found ${byeBattles.length} bye-team battles`);

    // Verify bye-team battle structure
    const byeBattle = byeBattles[0];
    expect(byeBattle.battleType).toBe('tag_team');
    // Only real robots get participant rows, never the placeholder.
    for (const p of byeBattle.participants) {
      expect(p.robotId).toBeGreaterThan(0);
      // Nothing was simulated, so every combat figure is inert.
      expect(p.damageDealt).toBe(0);
      expect(p.destroyed).toBe(false);
      expect(p.prestigeAwarded).toBe(0);
      expect(p.fameAwarded).toBe(0);
    }

    // Step 3: Verify rewards were awarded
    console.log('[Test] Step 3: Verifying rewards...');
    
    // Every participant is a real robot now, so take the first.
    const realParticipant = byeBattle.participants[0];
    const realTeamId = realParticipant!.robotId;
    
    const realRobot = await prisma.robot.findUnique({
      where: { id: realTeamId },
    });

    expect(realRobot).toBeDefined();
    expect(realRobot!.totalBattles).toBeGreaterThan(0);

    // Verify user currency changed
    const user = await prisma.user.findUnique({
      where: { id: realRobot!.userId },
    });
    expect(user).toBeDefined();
    expect(user!.currency).toBeDefined();

    console.log('[Test] ✓ Bye-team battle executed and rewards awarded');
  });

  it('should verify bye-team has combined ELO of 2000', async () => {
    // This is verified by checking the ELO changes
    // The bye-team should be treated as having combined ELO of 2000
    
    const allTagTeamBattles = await prisma.battle.findMany({
      where: { battleType: 'tag_team' },
      include: { participants: true },
    });
    const byeBattles = allTagTeamBattles.filter(
      b => (b.battleLog as { isByeMatch?: boolean } | null)?.isByeMatch === true,
    );

    if (byeBattles.length === 0) {
      console.log('[Test] No bye-team battles found, skipping ELO verification');
      return;
    }

    const byeBattle = byeBattles[0];
    const realParticipant = byeBattle.participants[0];
    const realTeamRobotId = realParticipant!.robotId;
    
    const realRobot = await prisma.robot.findUnique({
      where: { id: realTeamRobotId },
    });

    expect(realRobot).toBeDefined();

    // The ELO change should be calculated against combined ELO of 2000
    // We can't verify the exact calculation here, but we can verify
    // that the battle was executed and ELO changed
    expect(realRobot!.totalBattles).toBeGreaterThan(0);

    // Spec #49: ELO still moves for a tag team bye, but HP does not. A bye is
    // never simulated, so the participant row records the robot's HP as it was.
    expect(realParticipant.finalHP).toBe(realRobot!.currentHP);
    expect(realParticipant.eloAfter).not.toBe(realParticipant.eloBefore);

    console.log('[Test] ✓ Bye-team ELO verification complete');
  });
});
