/**
 * Property Test: Cycle Summary Includes Total Streaming Revenue
 * 
 * **Property 16: Cycle Summary Includes Total Streaming Revenue**
 * 
 * **Validates: Requirements 11.1-11.9**
 * 
 * For any cycle summary, the display should include a streaming revenue line item 
 * showing the total streaming revenue earned across all battles in the cycle.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { executeScheduledBattles } from '../src/services/battleOrchestrator';
import { executeScheduledTagTeamBattles } from '../src/services/tagTeamBattleOrchestrator';
import { clearSequenceCache } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

// Helper function to create a minimal test robot
async function createTestRobot(userId: number, battles: number, fame: number, name: string) {
  return await prisma.robot.create({
    data: {
      userId,
      name,
      frameId: 1,
      totalBattles: battles,
      fame,
      // Combat Systems
      combatPower: new Prisma.Decimal(10),
      targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10),
      penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10),
      attackSpeed: new Prisma.Decimal(10),
      // Defensive Systems
      armorPlating: new Prisma.Decimal(10),
      shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10),
      damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      // Chassis & Mobility
      hullIntegrity: new Prisma.Decimal(10),
      servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10),
      hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      // AI Processing
      combatAlgorithms: new Prisma.Decimal(10),
      threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10),
      logicCores: new Prisma.Decimal(10),
      // Team Coordination
      syncProtocols: new Prisma.Decimal(10),
      supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
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

describe('Property 16: Cycle Summary Includes Total Streaming Revenue', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        username: `test_cycle_summary_user1_${Date.now()}`,
        passwordHash: 'test',
        currency: 1000000,
        prestige: 5000,
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        username: `test_cycle_summary_user2_${Date.now()}`,
        passwordHash: 'test',
        currency: 1000000,
        prestige: 5000,
      },
    });
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    // Cleanup - delete in correct order to avoid foreign key constraints
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } },
          { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } },
          { robot2: { userId: testUserId2 } },
        ],
      },
    });

    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } },
          { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } },
          { robot2: { userId: testUserId2 } },
        ],
      },
    });

    await prisma.robot.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [{ id: testUserId1 }, { id: testUserId2 }],
      },
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Get current cycle number for clearing cache
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const cycleNumber = metadata?.totalCycles || 0;
    clearSequenceCache(cycleNumber);
  });

  it('should include totalStreamingRevenue property in battle execution summary', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          robot1Battles: fc.integer({ min: 0, max: 500 }),
          robot1Fame: fc.integer({ min: 0, max: 5000 }),
          robot2Battles: fc.integer({ min: 0, max: 500 }),
          robot2Fame: fc.integer({ min: 0, max: 5000 }),
          studioLevel1: fc.integer({ min: 0, max: 10 }),
          studioLevel2: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ robot1Battles, robot1Fame, robot2Battles, robot2Fame, studioLevel1, studioLevel2 }) => {
          // Create robots with specified stats
          const robot1 = await createTestRobot(
            testUserId1,
            robot1Battles,
            robot1Fame,
            `TestRobot1_${Date.now()}_${Math.random()}`
          );

          const robot2 = await createTestRobot(
            testUserId2,
            robot2Battles,
            robot2Fame,
            `TestRobot2_${Date.now()}_${Math.random()}`
          );

          // Create streaming studio facilities
          await prisma.facility.upsert({
            where: {
              userId_facilityType: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
              },
            },
            create: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
              level: studioLevel1,
            },
            update: {
              level: studioLevel1,
            },
          });

          await prisma.facility.upsert({
            where: {
              userId_facilityType: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
              },
            },
            create: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
              level: studioLevel2,
            },
            update: {
              level: studioLevel2,
            },
          });

          // Schedule battle
          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id,
              robot2Id: robot2.id,
              scheduledFor,
              status: 'scheduled',
              leagueType: 'bronze',
            },
          });

          // Execute battle
          const summary = await executeScheduledBattles(scheduledFor);

          // Verify summary includes totalStreamingRevenue
          expect(summary).toHaveProperty('totalStreamingRevenue');
          expect(typeof summary.totalStreamingRevenue).toBe('number');
          expect(summary.totalStreamingRevenue).toBeGreaterThanOrEqual(0);

          // Cleanup - delete in correct order
          const battles = await prisma.battle.findMany({
            where: {
              OR: [
                { robot1Id: robot1.id },
                { robot2Id: robot1.id },
                { robot1Id: robot2.id },
                { robot2Id: robot2.id },
              ],
            },
          });
          await prisma.battle.deleteMany({
            where: {
              id: { in: battles.map(b => b.id) },
            },
          });
          await prisma.scheduledMatch.delete({ where: { id: match.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should show ₡0 streaming revenue when no battles occurred', async () => {
    // Execute with no scheduled matches
    const summary = await executeScheduledBattles(new Date(Date.now() + 10000));

    // Verify summary includes totalStreamingRevenue as 0
    expect(summary).toHaveProperty('totalStreamingRevenue');
    expect(summary.totalStreamingRevenue).toBe(0);
  });
});
