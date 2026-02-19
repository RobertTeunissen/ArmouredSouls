import { PrismaClient } from '@prisma/client';
import { processTournamentBattle } from '../src/services/tournamentBattleOrchestrator';

const prisma = new PrismaClient();

describe('Tournament Streaming Revenue', () => {
  let testUser1: any;
  let testUser2: any;
  let practiceSword: any;
  let tournament: any;

  beforeAll(async () => {
    // Clean up in correct order to respect foreign key constraints
    await prisma.tournamentMatch.deleteMany({});
    await prisma.tournament.deleteMany({});
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.tagTeam.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});
    await prisma.cycleMetadata.deleteMany({});

    // Create cycle metadata
    await prisma.cycleMetadata.create({
      data: {
        id: 1,
        totalCycles: 1,
        lastCycleAt: new Date(),
      },
    });

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        username: 'tournament_test_user1',
        passwordHash: 'hash',
        currency: 1000000,
        prestige: 5000,
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        username: 'tournament_test_user2',
        passwordHash: 'hash',
        currency: 1000000,
        prestige: 3000,
      },
    });

    // Create Streaming Studio for user1 (level 5 = 1.5x multiplier)
    await prisma.facility.create({
      data: {
        userId: testUser1.id,
        facilityType: 'streaming_studio',
        level: 5,
      },
    });

    // Create practice sword
    practiceSword = await prisma.weapon.create({
      data: {
        name: 'Test Sword',
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Tournament Battle Streaming Revenue', () => {
    it('should award streaming revenue to both participants in a tournament battle', async () => {
      // Create two test robots with different stats
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser1.id, weaponId: practiceSword.id },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser2.id, weaponId: practiceSword.id },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser1.id,
          name: 'Tournament Fighter 1',
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

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser2.id,
          name: 'Tournament Fighter 2',
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

      // Create tournament
      tournament = await prisma.tournament.create({
        data: {
          name: 'Test Tournament',
          tournamentType: 'single_elimination',
          totalParticipants: 8,
          currentRound: 1,
          maxRounds: 3,
          status: 'active',
        },
      });

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
      const user1Before = await prisma.user.findUnique({ where: { id: testUser1.id } });
      const user2Before = await prisma.user.findUnique({ where: { id: testUser2.id } });

      // Process tournament battle
      const result = await processTournamentBattle(tournamentMatch);

      // Get final balances
      const user1After = await prisma.user.findUnique({ where: { id: testUser1.id } });
      const user2After = await prisma.user.findUnique({ where: { id: testUser2.id } });

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
      // Create a robot for bye match
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser1.id, weaponId: practiceSword.id },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser1.id,
          name: 'Bye Fighter',
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
