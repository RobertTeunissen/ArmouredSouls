/**
 * Property-Based Tests for Tournament Streaming Revenue
 * Property 20: Tournament Battles Award Streaming Revenue
 * 
 * **Validates: Requirements 16.1-16.7**
 * 
 * For any tournament battle (non-bye), streaming revenue should be calculated 
 * and awarded using the same formula as regular 1v1 battles:
 * 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + studioLevel×0.1)
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { processTournamentBattle } from '../src/services/tournamentBattleOrchestrator';

// Helper function to create a minimal test robot
async function createTestRobot(
  userId: number,
  name: string,
  battles: number,
  fame: number
) {
  return await prisma.robot.create({
    data: {
      userId,
      name,
      frameId: 1,
      totalBattles: battles,
      fame,
      // Combat Systems
      combatPower: new Prisma.Decimal(50),
      targetingSystems: new Prisma.Decimal(50),
      criticalSystems: new Prisma.Decimal(50),
      penetration: new Prisma.Decimal(50),
      weaponControl: new Prisma.Decimal(50),
      attackSpeed: new Prisma.Decimal(50),
      // Defensive Systems
      armorPlating: new Prisma.Decimal(50),
      shieldCapacity: new Prisma.Decimal(50),
      evasionThrusters: new Prisma.Decimal(50),
      damageDampeners: new Prisma.Decimal(50),
      counterProtocols: new Prisma.Decimal(50),
      // Chassis & Mobility
      hullIntegrity: new Prisma.Decimal(50),
      servoMotors: new Prisma.Decimal(50),
      gyroStabilizers: new Prisma.Decimal(50),
      hydraulicSystems: new Prisma.Decimal(50),
      powerCore: new Prisma.Decimal(50),
      // AI Processing
      combatAlgorithms: new Prisma.Decimal(50),
      threatAnalysis: new Prisma.Decimal(50),
      adaptiveAI: new Prisma.Decimal(50),
      logicCores: new Prisma.Decimal(50),
      // Team Coordination
      syncProtocols: new Prisma.Decimal(50),
      supportSystems: new Prisma.Decimal(50),
      formationTactics: new Prisma.Decimal(50),
      // Combat State
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      damageTaken: 0,
      // Performance
      elo: 1200,
      wins: 0,
      draws: 0,
      losses: 0,
      damageDealtLifetime: 0,
      damageTakenLifetime: 0,
      kills: 0,
      // League & Fame
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      cyclesInCurrentLeague: 0,
      // Economic
      repairCost: 0,
      battleReadiness: 100,
      totalRepairsPaid: 0,
      // Configuration
      yieldThreshold: 10,
      loadoutType: 'single',
      stance: 'balanced',
      mainWeaponId: null,
    },
  });
}

// Helper function to create a tournament
async function createTestTournament(
  name: string,
  totalParticipants: number,
  currentRound: number,
  maxRounds: number
) {
  return await prisma.tournament.create({
    data: {
      name,
      tournamentType: 'single_elimination',
      totalParticipants,
      currentRound,
      maxRounds,
      status: 'active',
    },
  });
}

// Helper function to create a tournament match
async function createTournamentMatch(
  tournamentId: number,
  robot1Id: number,
  robot2Id: number,
  round: number,
  isByeMatch: boolean = false
) {
  return await prisma.tournamentMatch.create({
    data: {
      tournamentId,
      robot1Id,
      robot2Id,
      round,
      matchNumber: 1, // Required field
      status: 'pending',
      isByeMatch,
    },
  });
}

describe('Property 20: Tournament Battles Award Streaming Revenue', () => {
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        username: `test_user_tournament_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        username: `test_user_tournament_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robotStreamingRevenue.deleteMany({
      where: {
        robot: {
          userId: {
            in: [testUser1.id, testUser2.id],
          },
        },
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1.id } },
          { robot2: { userId: testUser1.id } },
          { robot1: { userId: testUser2.id } },
          { robot2: { userId: testUser2.id } },
        ],
      },
    });
    await prisma.tournamentMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1.id } },
          { robot2: { userId: testUser1.id } },
          { robot1: { userId: testUser2.id } },
          { robot2: { userId: testUser2.id } },
        ],
      },
    });
    await prisma.tournament.deleteMany({});
    await prisma.robot.deleteMany({
      where: {
        userId: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });
    await prisma.facility.deleteMany({
      where: {
        userId: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });
    await prisma.user.delete({ where: { id: testUser1.id } });
    await prisma.user.delete({ where: { id: testUser2.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.robotStreamingRevenue.deleteMany({
      where: {
        robot: {
          userId: {
            in: [testUser1.id, testUser2.id],
          },
        },
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1.id } },
          { robot2: { userId: testUser1.id } },
          { robot1: { userId: testUser2.id } },
          { robot2: { userId: testUser2.id } },
        ],
      },
    });
    await prisma.tournamentMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1.id } },
          { robot2: { userId: testUser1.id } },
          { robot1: { userId: testUser2.id } },
          { robot2: { userId: testUser2.id } },
        ],
      },
    });
    await prisma.tournament.deleteMany({});
    await prisma.robot.deleteMany({
      where: {
        userId: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });
    await prisma.facility.deleteMany({
      where: {
        userId: {
          in: [testUser1.id, testUser2.id],
        },
      },
    });
  });

  /**
   * Property 20: For any tournament battle (non-bye), streaming revenue should 
   * be calculated and awarded using the same formula as 1v1 battles
   */
  test('Property 20: Tournament battles award streaming revenue using same formula as 1v1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level for user 1
        fc.integer({ min: 0, max: 10 }),    // studio level for user 2
        fc.integer({ min: 1, max: 4 }),     // tournament round (1-4)
        async (battles1, fame1, battles2, fame2, studioLevel1, studioLevel2, round) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: {
                in: [testUser1.id, testUser2.id],
              },
              facilityType: 'streaming_studio',
            },
          });

          // Create robots with specified stats
          const robot1 = await createTestRobot(
            testUser1.id,
            `TR1_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            battles1,
            fame1
          );

          const robot2 = await createTestRobot(
            testUser2.id,
            `TR2_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            battles2,
            fame2
          );

          // Create Streaming Studio facilities
          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1.id,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
            });
          }

          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser2.id,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
            });
          }

          // Get initial balances
          const user1Before = await prisma.user.findUnique({
            where: { id: testUser1.id },
            select: { currency: true },
          });
          const user2Before = await prisma.user.findUnique({
            where: { id: testUser2.id },
            select: { currency: true },
          });

          // Create tournament
          const maxRounds = 4;
          const tournament = await createTestTournament(
            `TestTournament_${Date.now()}`,
            16, // 16 participants
            round,
            maxRounds
          );

          // Create tournament match (non-bye)
          const tournamentMatch = await createTournamentMatch(
            tournament.id,
            robot1.id,
            robot2.id,
            round,
            false // NOT a bye match
          );

          // Process tournament battle
          const result = await processTournamentBattle(tournamentMatch);

          // Property: Battle should be created
          expect(result.battleId).toBeDefined();
          expect(result.isByeMatch).toBe(false);

          // Get updated balances
          const user1After = await prisma.user.findUnique({
            where: { id: testUser1.id },
            select: { currency: true },
          });
          const user2After = await prisma.user.findUnique({
            where: { id: testUser2.id },
            select: { currency: true },
          });

          // Get the battle to check battle rewards and fame awarded
          const battle = await prisma.battle.findUnique({
            where: { id: result.battleId },
            select: {
              winnerId: true,
              winnerReward: true,
              loserReward: true,
              robot1FameAwarded: true,
              robot2FameAwarded: true,
            },
          });

          // Calculate expected streaming revenue using the formula
          // NOTE: Robot battle counts and fame are updated BEFORE streaming revenue calculation
          // (Requirements 2.8, 3.8), so we need to account for the updates
          const baseAmount = 1000;
          
          // Robot 1: battles incremented by 1, fame incremented if winner
          const isRobot1Winner = battle!.winnerId === robot1.id;
          const robot1FinalBattles = battles1 + 1;
          const robot1FinalFame = fame1 + (isRobot1Winner ? battle!.robot1FameAwarded : 0);
          const battleMultiplier1 = 1 + (robot1FinalBattles / 1000);
          const fameMultiplier1 = 1 + (robot1FinalFame / 5000);
          const studioMultiplier1 = 1 + (studioLevel1 * 0.1);
          const expectedRevenue1 = Math.floor(
            baseAmount * battleMultiplier1 * fameMultiplier1 * studioMultiplier1
          );

          // Robot 2: battles incremented by 1, fame incremented if winner
          const isRobot2Winner = battle!.winnerId === robot2.id;
          const robot2FinalBattles = battles2 + 1;
          const robot2FinalFame = fame2 + (isRobot2Winner ? battle!.robot2FameAwarded : 0);
          const battleMultiplier2 = 1 + (robot2FinalBattles / 1000);
          const fameMultiplier2 = 1 + (robot2FinalFame / 5000);
          const studioMultiplier2 = 1 + (studioLevel2 * 0.1);
          const expectedRevenue2 = Math.floor(
            baseAmount * battleMultiplier2 * fameMultiplier2 * studioMultiplier2
          );

          // Calculate expected balance changes
          // Balance change = battle reward + streaming revenue
          const expectedBalanceChange1 =
            (isRobot1Winner ? (battle!.winnerReward || 0) : (battle!.loserReward || 0)) + expectedRevenue1;
          const expectedBalanceChange2 =
            (isRobot2Winner ? (battle!.winnerReward || 0) : (battle!.loserReward || 0)) + expectedRevenue2;

          // Property: User balances should increase by battle reward + streaming revenue
          const actualBalanceChange1 = user1After!.currency - user1Before!.currency;
          const actualBalanceChange2 = user2After!.currency - user2Before!.currency;

          expect(actualBalanceChange1).toBe(expectedBalanceChange1);
          expect(actualBalanceChange2).toBe(expectedBalanceChange2);

          // Property: Streaming revenue should be tracked in analytics
          const streamingRevenue1 = await prisma.robotStreamingRevenue.findFirst({
            where: {
              robotId: robot1.id,
            },
          });

          const streamingRevenue2 = await prisma.robotStreamingRevenue.findFirst({
            where: {
              robotId: robot2.id,
            },
          });

          expect(streamingRevenue1).not.toBeNull();
          expect(streamingRevenue2).not.toBeNull();
          expect(streamingRevenue1!.streamingRevenue).toBe(expectedRevenue1);
          expect(streamingRevenue2!.streamingRevenue).toBe(expectedRevenue2);

          // Property: Battle should be marked as tournament type
          const battleRecord = await prisma.battle.findUnique({
            where: { id: result.battleId },
            select: {
              battleType: true,
              tournamentId: true,
              tournamentRound: true,
            },
          });

          expect(battleRecord!.battleType).toBe('tournament');
          expect(battleRecord!.tournamentId).toBe(tournament.id);
          expect(battleRecord!.tournamentRound).toBe(round);

          // Clean up for next iteration
          await prisma.robotStreamingRevenue.deleteMany({
            where: {
              robotId: {
                in: [robot1.id, robot2.id],
              },
            },
          });
          await prisma.battle.delete({ where: { id: result.battleId } });
          await prisma.tournamentMatch.delete({ where: { id: tournamentMatch.id } });
          await prisma.tournament.delete({ where: { id: tournament.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and increased timeout
    );
  }, 600000); // 10 minute test timeout

  /**
   * Property 20.1: Tournament battles award streaming revenue to both winner and loser
   */
  test('Property 20.1: Tournament battles award streaming revenue to both winner and loser', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 500, max: 25000 }), // fame for robot 1
        fc.integer({ min: 100, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 500, max: 25000 }), // fame for robot 2
        fc.integer({ min: 1, max: 10 }),      // studio level (non-zero)
        fc.integer({ min: 1, max: 4 }),       // tournament round
        async (battles1, fame1, battles2, fame2, studioLevel, round) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: {
                in: [testUser1.id, testUser2.id],
              },
              facilityType: 'streaming_studio',
            },
          });

          // Create robots
          const robot1 = await createTestRobot(
            testUser1.id,
            `W_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            battles1,
            fame1
          );

          const robot2 = await createTestRobot(
            testUser2.id,
            `L_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            battles2,
            fame2
          );

          // Create Streaming Studio facilities for both users
          await prisma.facility.create({
            data: {
              userId: testUser1.id,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
          });

          await prisma.facility.create({
            data: {
              userId: testUser2.id,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
          });

          // Get initial balances
          const user1Before = await prisma.user.findUnique({
            where: { id: testUser1.id },
            select: { currency: true },
          });
          const user2Before = await prisma.user.findUnique({
            where: { id: testUser2.id },
            select: { currency: true },
          });

          // Create tournament and match
          const tournament = await createTestTournament(
            `TestTournament_${Date.now()}`,
            16,
            round,
            4
          );

          const tournamentMatch = await createTournamentMatch(
            tournament.id,
            robot1.id,
            robot2.id,
            round,
            false
          );

          // Process tournament battle
          await processTournamentBattle(tournamentMatch);

          // Get updated balances
          const user1After = await prisma.user.findUnique({
            where: { id: testUser1.id },
            select: { currency: true },
          });
          const user2After = await prisma.user.findUnique({
            where: { id: testUser2.id },
            select: { currency: true },
          });

          // Property: Both users should have received streaming revenue
          // (balance should increase by more than just battle rewards)
          const balanceChange1 = user1After!.currency - user1Before!.currency;
          const balanceChange2 = user2After!.currency - user2Before!.currency;

          expect(balanceChange1).toBeGreaterThan(0);
          expect(balanceChange2).toBeGreaterThan(0);

          // Property: Both robots should have streaming revenue tracked
          const streamingRevenue1 = await prisma.robotStreamingRevenue.findFirst({
            where: { robotId: robot1.id },
          });

          const streamingRevenue2 = await prisma.robotStreamingRevenue.findFirst({
            where: { robotId: robot2.id },
          });

          expect(streamingRevenue1).not.toBeNull();
          expect(streamingRevenue2).not.toBeNull();
          expect(streamingRevenue1!.streamingRevenue).toBeGreaterThan(0);
          expect(streamingRevenue2!.streamingRevenue).toBeGreaterThan(0);

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: { in: [robot1.id, robot2.id] } },
          });
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot1.id }, { robot2Id: robot2.id }],
            },
          });
          await prisma.tournamentMatch.delete({ where: { id: tournamentMatch.id } });
          await prisma.tournament.delete({ where: { id: tournament.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 30, timeout: 10000 } // Reduced runs and increased timeout
    );
  }, 600000); // 10 minute test timeout

  /**
   * Property 20.2: Tournament battles in different rounds all award streaming revenue
   */
  test('Property 20.2: All tournament rounds award streaming revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles
        fc.integer({ min: 0, max: 25000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: {
                in: [testUser1.id, testUser2.id],
              },
              facilityType: 'streaming_studio',
            },
          });

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });

            await prisma.facility.create({
              data: {
                userId: testUser2.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Test all rounds (1-4: Round 1, Quarterfinals, Semifinals, Finals)
          const rounds = [1, 2, 3, 4];
          const streamingRevenueRecords: number[] = [];

          for (const round of rounds) {
            // Create NEW robots for each round to avoid unique constraint violations
            const robot1 = await createTestRobot(
              testUser1.id,
              `R${round}_1_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              battles,
              fame
            );

            const robot2 = await createTestRobot(
              testUser2.id,
              `R${round}_2_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              battles,
              fame
            );

            // Create tournament and match for this round
            const tournament = await createTestTournament(
              `TestTournament_Round${round}_${Date.now()}`,
              16,
              round,
              4
            );

            const tournamentMatch = await createTournamentMatch(
              tournament.id,
              robot1.id,
              robot2.id,
              round,
              false
            );

            // Process tournament battle
            await processTournamentBattle(tournamentMatch);

            // Check streaming revenue was tracked
            const streamingRevenue = await prisma.robotStreamingRevenue.findFirst({
              where: {
                robotId: robot1.id,
                cycleNumber: 1, // All tests use cycle 1
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            // Property: Streaming revenue should be tracked for this round
            expect(streamingRevenue).not.toBeNull();
            streamingRevenueRecords.push(streamingRevenue!.streamingRevenue);

            // Clean up for next round
            await prisma.robotStreamingRevenue.deleteMany({
              where: { robotId: { in: [robot1.id, robot2.id] } },
            });
            await prisma.battle.deleteMany({
              where: {
                OR: [{ robot1Id: robot1.id }, { robot2Id: robot2.id }],
              },
            });
            await prisma.tournamentMatch.delete({ where: { id: tournamentMatch.id } });
            await prisma.tournament.delete({ where: { id: tournament.id } });
            await prisma.robot.delete({ where: { id: robot1.id } });
            await prisma.robot.delete({ where: { id: robot2.id } });
          }

          // Property: All rounds should have awarded streaming revenue
          // NOTE: Each round uses fresh robots with the same initial stats,
          // so all should award the same streaming revenue (battles + 1, fame + fameAwarded)
          streamingRevenueRecords.forEach((revenue) => {
            expect(revenue).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 10, timeout: 20000 } // Very reduced runs since we test 4 rounds per iteration
    );
  }, 600000); // 10 minute test timeout

  /**
   * Property 20.3: Tournament streaming revenue uses same formula as 1v1
   * (formula consistency check)
   */
  test('Property 20.3: Tournament streaming revenue formula matches 1v1 formula', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles
        fc.integer({ min: 0, max: 25000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser1.id,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot
          const robot = await createTestRobot(
            testUser1.id,
            `FT_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            battles,
            fame
          );

          const opponent = await createTestRobot(
            testUser2.id,
            `OP_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            0,
            0
          );

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Create tournament and match
          const tournament = await createTestTournament(
            `TestTournament_${Date.now()}`,
            16,
            1,
            4
          );

          const tournamentMatch = await createTournamentMatch(
            tournament.id,
            robot.id,
            opponent.id,
            1,
            false
          );

          // Process tournament battle
          const result = await processTournamentBattle(tournamentMatch);

          // Get the battle to check fame awarded
          const battle = await prisma.battle.findUnique({
            where: { id: result.battleId },
            select: {
              winnerId: true,
              robot1FameAwarded: true,
            },
          });

          // Get streaming revenue from analytics
          const streamingRevenue = await prisma.robotStreamingRevenue.findFirst({
            where: { robotId: robot.id },
          });

          // Calculate expected revenue using the formula
          // NOTE: Robot battle count and fame are updated BEFORE streaming revenue calculation
          // (Requirements 2.8, 3.8)
          const baseAmount = 1000;
          const isWinner = battle!.winnerId === robot.id;
          const finalBattles = battles + 1; // Battle count incremented
          const finalFame = fame + (isWinner ? battle!.robot1FameAwarded : 0); // Fame incremented if winner
          const battleMultiplier = 1 + (finalBattles / 1000);
          const fameMultiplier = 1 + (finalFame / 5000);
          const studioMultiplier = 1 + (studioLevel * 0.1);
          const expectedRevenue = Math.floor(
            baseAmount * battleMultiplier * fameMultiplier * studioMultiplier
          );

          // Property: Streaming revenue should match the formula exactly
          expect(streamingRevenue).not.toBeNull();
          expect(streamingRevenue!.streamingRevenue).toBe(expectedRevenue);

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: { in: [robot.id, opponent.id] } },
          });
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot.id }, { robot2Id: opponent.id }],
            },
          });
          await prisma.tournamentMatch.delete({ where: { id: tournamentMatch.id } });
          await prisma.tournament.delete({ where: { id: tournament.id } });
          await prisma.robot.delete({ where: { id: robot.id } });
          await prisma.robot.delete({ where: { id: opponent.id } });
        }
      ),
      { numRuns: 50, timeout: 10000 } // Reduced runs and increased timeout
    );
  }, 600000); // 10 minute test timeout
});
