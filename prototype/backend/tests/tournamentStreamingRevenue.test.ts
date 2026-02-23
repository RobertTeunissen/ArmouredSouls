import { PrismaClient } from '@prisma/client';
import { processTournamentBattle } from '../src/services/tournamentBattleOrchestrator';

const prisma = new PrismaClient();

describe('Tournament Streaming Revenue', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testWeaponIds: number[] = [];
  let testWeaponInvIds: number[] = [];
  let testTournamentIds: number[] = [];
  let testFacilityIds: number[] = [];
  let practiceSword: any;
  let tournament: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Create cycle metadata
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        totalCycles: 1,
        lastCycleAt: new Date(),
      },
      update: {
        totalCycles: 1,
        lastCycleAt: new Date(),
      },
    });

    // Create test users
    const timestamp = Date.now();
    const testUser1 = await prisma.user.create({
      data: {
        username: `tournament_test_user1_${timestamp}`,
        passwordHash: 'hash',
        currency: 1000000,
        prestige: 5000,
      },
    });
    testUserIds.push(testUser1.id);

    const testUser2 = await prisma.user.create({
      data: {
        username: `tournament_test_user2_${timestamp}`,
        passwordHash: 'hash',
        currency: 1000000,
        prestige: 3000,
      },
    });
    testUserIds.push(testUser2.id);

    // Create Streaming Studio for user1 (level 5 = 1.5x multiplier)
    const facility = await prisma.facility.create({
      data: {
        userId: testUser1.id,
        facilityType: 'streaming_studio',
        level: 5,
      },
    });
    testFacilityIds.push(facility.id);

    // Create practice sword
    practiceSword = await prisma.weapon.create({
      data: {
        name: `Test Sword ${timestamp}`,
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
      },
    });
    testWeaponIds.push(practiceSword.id);
  });

  afterEach(async () => {
    // Clean up test data between tests (but keep users, weapons, facilities, and tournament from beforeAll/first test)
    await prisma.tournamentMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.weaponInventory.deleteMany({
      where: { 
        userId: { in: testUserIds },
        id: { in: testWeaponInvIds },
      },
    });
    
    // Reset tracking arrays (but keep testUserIds, testWeaponIds, testFacilityIds, testTournamentIds)
    testRobotIds = [];
    testWeaponInvIds = [];
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.tournamentMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.tournament.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    await prisma.$disconnect();
  });

  describe('Tournament Battle Streaming Revenue', () => {
    it('should award streaming revenue to both participants in a tournament battle', async () => {
      // Get user IDs
      const testUser1Id = testUserIds[0];
      const testUser2Id = testUserIds[1];

      // Create two test robots with different stats
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser1Id, weaponId: practiceSword.id },
      });
      testWeaponInvIds.push(weaponInv1.id);

      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser2Id, weaponId: practiceSword.id },
      });
      testWeaponInvIds.push(weaponInv2.id);

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser1Id,
          name: `Tournament Fighter 1 ${Date.now()}`,
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          mainWeaponId: weaponInv1.id,
          totalBattles: 500, // 1.5x battle multiplier
          fame: 2500, // 1.5x fame multiplier
        },
      });
      testRobotIds.push(robot1.id);

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser2Id,
          name: `Tournament Fighter 2 ${Date.now()}`,
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          mainWeaponId: weaponInv2.id,
          totalBattles: 100, // 1.1x battle multiplier
          fame: 500, // 1.1x fame multiplier
        },
      });
      testRobotIds.push(robot2.id);

      // Create tournament
      tournament = await prisma.tournament.create({
        data: {
          name: `Test Tournament ${Date.now()}`,
          tournamentType: 'single_elimination',
          totalParticipants: 8,
          currentRound: 1,
          maxRounds: 3,
          status: 'active',
        },
      });
      testTournamentIds.push(tournament.id);

      // Create tournament match
      const tournamentMatch = await prisma.tournamentMatch.create({
        data: {
          tournamentId: tournament.id,
          round: 1,
          matchNumber: 1,
          robot1Id: robot1.id,
          robot2Id: robot2.id,
          status: 'pending',
          isByeMatch: false,
        },
      });

      // Get initial balances
      const user1Before = await prisma.user.findUnique({ where: { id: testUser1Id } });
      const user2Before = await prisma.user.findUnique({ where: { id: testUser2Id } });

      // Process tournament battle
      const result = await processTournamentBattle(tournamentMatch);

      // Get final balances
      const user1After = await prisma.user.findUnique({ where: { id: testUser1Id } });
      const user2After = await prisma.user.findUnique({ where: { id: testUser2Id } });

      // Calculate expected streaming revenue
      // User1: 1000 × 1.5 (battles) × 1.5 (fame) × 1.5 (studio level 5) = 3375
      const expectedRevenue1 = Math.floor(1000 * 1.5 * 1.5 * 1.5);
      
      // User2: 1000 × 1.1 (battles) × 1.1 (fame) × 1.0 (no studio) = 1210
      const expectedRevenue2 = Math.floor(1000 * 1.1 * 1.1 * 1.0);

      // Verify streaming revenue was awarded (accounting for battle winnings)
      const balanceChange1 = user1After!.currency - user1Before!.currency;
      const balanceChange2 = user2After!.currency - user2Before!.currency;

      // Both should have received streaming revenue plus battle rewards
      expect(balanceChange1).toBeGreaterThanOrEqual(expectedRevenue1);
      expect(balanceChange2).toBeGreaterThanOrEqual(expectedRevenue2);

      // Verify battle was created
      expect(result.battleId).toBeDefined();
      expect(result.winnerId).toBeDefined();
      expect(result.isByeMatch).toBe(false);

      // Verify battle record exists
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
      });
      expect(battle).toBeDefined();
      expect(battle!.battleType).toBe('tournament');
      expect(battle!.tournamentId).toBe(tournament.id);
      expect(battle!.tournamentRound).toBe(1);
    });

    it('should not award streaming revenue for bye matches', async () => {
      // Get user ID
      const testUser1Id = testUserIds[0];

      // Create a robot for bye match
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser1Id, weaponId: practiceSword.id },
      });
      testWeaponInvIds.push(weaponInv.id);

      const robot = await prisma.robot.create({
        data: {
          userId: testUser1Id,
          name: `Bye Fighter ${Date.now()}`,
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          mainWeaponId: weaponInv.id,
          totalBattles: 500,
          fame: 2500,
        },
      });
      testRobotIds.push(robot.id);

      // Create bye match
      const byeMatch = await prisma.tournamentMatch.create({
        data: {
          tournamentId: tournament.id,
          round: 2,
          matchNumber: 1,
          robot1Id: robot.id,
          robot2Id: null,
          status: 'pending',
          isByeMatch: true,
        },
      });

      // Attempting to process a bye match should throw an error
      // The function checks for missing robots first, then checks for bye match
      await expect(processTournamentBattle(byeMatch)).rejects.toThrow(
        'missing robots'
      );
    });
  });
});
