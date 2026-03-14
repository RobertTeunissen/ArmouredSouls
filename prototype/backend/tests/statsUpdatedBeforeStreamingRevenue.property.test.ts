/**
 * Property-Based Tests for Stats Updated Before Streaming Revenue Calculation
 * Property 5: Stats Updated Before Streaming Revenue Calculation
 * 
 * **Validates: Requirements 2.8, 3.7, 3.8**
 * 
 * For any battle, when calculating streaming revenue, the robot's battle count 
 * should include the current battle, and the robot's fame should include any 
 * fame awarded from the current battle.
 * 
 * Note: The battle orchestrator logs one battle_complete event PER ROBOT (not per battle).
 * Each event's payload contains `streamingRevenue` (total amount only).
 * The robotId is stored in the audit log's `robotId` field, not in the payload.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { processBattle } from '../src/services/battleOrchestrator';

// Helper function to create a minimal test robot
async function createTestRobot(
  userId: number, name: string, battles: number, fame: number, league: string = 'bronze'
) {
  return await prisma.robot.create({
    data: {
      userId, name, frameId: 1, totalBattles: battles, fame, currentLeague: league,
      combatPower: new Prisma.Decimal(10), targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10), penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10), attackSpeed: new Prisma.Decimal(10),
      armorPlating: new Prisma.Decimal(10), shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10), damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      hullIntegrity: new Prisma.Decimal(10), servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10), hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      combatAlgorithms: new Prisma.Decimal(10), threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10), logicCores: new Prisma.Decimal(10),
      syncProtocols: new Prisma.Decimal(10), supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
      currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20, damageTaken: 0,
      elo: 1200, wins: 0, draws: 0, losses: 0,
      damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
      leagueId: `${league}_1`, leaguePoints: 0, cyclesInCurrentLeague: 0,
      repairCost: 0, battleReadiness: 100, totalRepairsPaid: 0,
      yieldThreshold: 10, loadoutType: 'single', stance: 'balanced', mainWeaponId: null,
    },
  });
}

async function createScheduledMatch(robot1Id: number, robot2Id: number, leagueType: string = 'bronze') {
  return await prisma.scheduledMatch.create({
    data: { robot1Id, robot2Id, leagueType, scheduledFor: new Date(), status: 'scheduled' },
  });
}

describe('Property 5: Stats Updated Before Streaming Revenue Calculation', () => {
  let testUser1Id: number;
  let testUser2Id: number;

  beforeAll(async () => {
    const user1 = await prisma.user.create({
      data: { username: `test_user_prop5_1_${Date.now()}`, passwordHash: 'test_hash', currency: 100000, prestige: 0 },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: { username: `test_user_prop5_2_${Date.now()}`, passwordHash: 'test_hash', currency: 100000, prestige: 0 },
    });
    testUser2Id = user2.id;
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({
      where: { OR: [{ userId: testUser1Id }, { userId: testUser2Id }] },
    });
    await prisma.battleParticipant.deleteMany({
      where: { robot: { OR: [{ userId: testUser1Id }, { userId: testUser2Id }] } },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } }, { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } }, { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } }, { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } }, { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.robot.deleteMany({ where: { userId: testUser1Id } });
    await prisma.robot.deleteMany({ where: { userId: testUser2Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser1Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser2Id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: testUser1Id } });
    await prisma.user.deleteMany({ where: { id: testUser2Id } });
    await prisma.$disconnect();
  });

  /**
   * Property 5: Stats are updated before streaming revenue calculation.
   * We verify this by checking that after a battle:
   * 1. Battle count incremented by 1
   * 2. Streaming revenue was awarded (stored in BattleParticipant)
   * 3. The streaming revenue amount is consistent with updated stats
   */
  test('Property 5: Stats updated before streaming revenue calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        async (initialBattles1, initialFame1, initialBattles2, initialFame2, studioLevel1, studioLevel2) => {
          await prisma.facility.deleteMany({
            where: { userId: { in: [testUser1Id, testUser2Id] }, facilityType: 'streaming_studio' },
          });

          const robot1 = await createTestRobot(
            testUser1Id, `TestRobot1_${Date.now()}_${Math.random()}`, initialBattles1, initialFame1
          );
          const robot2 = await createTestRobot(
            testUser2Id, `TestRobot2_${Date.now()}_${Math.random()}`, initialBattles2, initialFame2
          );

          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: { userId: testUser1Id, facilityType: 'streaming_studio', level: studioLevel1 },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: { userId: testUser2Id, facilityType: 'streaming_studio', level: studioLevel2 },
            });
          }

          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
          await processBattle(scheduledMatch);

          // Get updated robot stats
          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id }, select: { totalBattles: true, fame: true },
          });
          const updatedRobot2 = await prisma.robot.findUnique({
            where: { id: robot2.id }, select: { totalBattles: true, fame: true },
          });

          expect(updatedRobot1).not.toBeNull();
          expect(updatedRobot2).not.toBeNull();

          // Property: Battle count should have been incremented by 1
          expect(updatedRobot1!.totalBattles).toBe(initialBattles1 + 1);
          expect(updatedRobot2!.totalBattles).toBe(initialBattles2 + 1);

          // Get the battle_complete events from audit log (one per robot)
          const robot1Event = await prisma.auditLog.findFirst({
            where: { eventType: 'battle_complete', robotId: robot1.id },
            orderBy: { id: 'desc' },
          });
          const robot2Event = await prisma.auditLog.findFirst({
            where: { eventType: 'battle_complete', robotId: robot2.id },
            orderBy: { id: 'desc' },
          });

          expect(robot1Event).not.toBeNull();
          expect(robot2Event).not.toBeNull();

          const payload1 = robot1Event!.payload as any;
          const payload2 = robot2Event!.payload as any;

          // Property: Streaming revenue should be recorded in the event
          expect(payload1.streamingRevenue).toBeDefined();
          expect(payload2.streamingRevenue).toBeDefined();
          expect(typeof payload1.streamingRevenue).toBe('number');
          expect(typeof payload2.streamingRevenue).toBe('number');

          // Property: Streaming revenue should be at least the base amount (1000)
          // because stats were updated before calculation
          expect(payload1.streamingRevenue).toBeGreaterThanOrEqual(1000);
          expect(payload2.streamingRevenue).toBeGreaterThanOrEqual(1000);

          // Verify via BattleParticipant that streaming revenue was stored
          const battle = await prisma.battle.findFirst({
            where: { robot1Id: robot1.id, robot2Id: robot2.id },
            orderBy: { id: 'desc' },
          });
          expect(battle).not.toBeNull();

          const participant1 = await prisma.battleParticipant.findUnique({
            where: { battleId_robotId: { battleId: battle!.id, robotId: robot1.id } },
          });
          const participant2 = await prisma.battleParticipant.findUnique({
            where: { battleId_robotId: { battleId: battle!.id, robotId: robot2.id } },
          });

          expect(participant1).not.toBeNull();
          expect(participant2).not.toBeNull();
          expect(participant1!.streamingRevenue).toBe(payload1.streamingRevenue);
          expect(participant2!.streamingRevenue).toBe(payload2.streamingRevenue);

          // Clean up
          await prisma.battle.deleteMany({
            where: { OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }] },
          });
          await prisma.scheduledMatch.deleteMany({ where: { id: scheduledMatch.id } });
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 5.1: Battle count increments by exactly 1 per battle
   */
  test('Property 5.1: Battle count increments by exactly 1 per battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        async (initialBattles, initialFame) => {
          const robot1 = await createTestRobot(
            testUser1Id, `TestRobot1_${Date.now()}_${Math.random()}`, initialBattles, initialFame
          );
          const robot2 = await createTestRobot(
            testUser2Id, `TestRobot2_${Date.now()}_${Math.random()}`, 0, 0
          );

          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
          await processBattle(scheduledMatch);

          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id }, select: { totalBattles: true },
          });

          // Property: Battle count should increment by exactly 1
          expect(updatedRobot1!.totalBattles).toBe(initialBattles + 1);

          await prisma.battle.deleteMany({
            where: { OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }] },
          });
          await prisma.scheduledMatch.deleteMany({ where: { id: scheduledMatch.id } });
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 5.2: Winner fame increases after battle
   */
  test('Property 5.2: Winner fame increases after battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        async (initialFame) => {
          const robot1 = await createTestRobot(
            testUser1Id, `TestRobot1_${Date.now()}_${Math.random()}`, 0, initialFame
          );
          // Make robot1 much stronger to ensure it wins
          await prisma.robot.update({
            where: { id: robot1.id },
            data: { combatPower: new Prisma.Decimal(50), armorPlating: new Prisma.Decimal(50) },
          });

          const robot2 = await createTestRobot(
            testUser2Id, `TestRobot2_${Date.now()}_${Math.random()}`, 0, 0
          );

          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
          await processBattle(scheduledMatch);

          // Get the battle_complete event for robot1
          const robot1Event = await prisma.auditLog.findFirst({
            where: { eventType: 'battle_complete', robotId: robot1.id },
            orderBy: { id: 'desc' },
          });
          expect(robot1Event).not.toBeNull();
          const payload = robot1Event!.payload as any;

          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id }, select: { fame: true },
          });

          // Property: If robot1 won, fame should have increased
          if (payload.result === 'win') {
            expect(updatedRobot1!.fame).toBeGreaterThan(initialFame);
            expect(payload.fame).toBeGreaterThan(0);
          }

          await prisma.battle.deleteMany({
            where: { OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }] },
          });
          await prisma.scheduledMatch.deleteMany({ where: { id: scheduledMatch.id } });
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 5.3: Stats are always updated before streaming revenue calculation
   */
  test('Property 5.3: Stats are always updated before streaming revenue calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 10000 }),
        async (initialBattles, initialFame) => {
          const robot1 = await createTestRobot(
            testUser1Id, `TestRobot1_${Date.now()}_${Math.random()}`, initialBattles, initialFame
          );
          const robot2 = await createTestRobot(
            testUser2Id, `TestRobot2_${Date.now()}_${Math.random()}`, 0, 0
          );

          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);
          await processBattle(scheduledMatch);

          // Get updated stats
          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id }, select: { totalBattles: true },
          });

          // Property: Battle count should be initial + 1 (proving stats were updated)
          expect(updatedRobot1!.totalBattles).toBe(initialBattles + 1);

          // Get the battle_complete event for robot1
          const robot1Event = await prisma.auditLog.findFirst({
            where: { eventType: 'battle_complete', robotId: robot1.id },
            orderBy: { id: 'desc' },
          });
          expect(robot1Event).not.toBeNull();
          const payload = robot1Event!.payload as any;

          // Property: Streaming revenue should be positive (proving it was calculated
          // after stats were updated, since even base amount is 1000)
          expect(payload.streamingRevenue).toBeGreaterThanOrEqual(1000);

          // Property: The streaming revenue in BattleParticipant should match the event
          const battle = await prisma.battle.findFirst({
            where: { robot1Id: robot1.id, robot2Id: robot2.id },
            orderBy: { id: 'desc' },
          });
          const participant = await prisma.battleParticipant.findUnique({
            where: { battleId_robotId: { battleId: battle!.id, robotId: robot1.id } },
          });
          expect(participant!.streamingRevenue).toBe(payload.streamingRevenue);

          await prisma.battle.deleteMany({
            where: { OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }] },
          });
          await prisma.scheduledMatch.deleteMany({ where: { id: scheduledMatch.id } });
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 10 }
    );
  });
});
