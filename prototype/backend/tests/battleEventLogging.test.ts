/**
 * Integration test for battle event logging
 * 
 * Verifies that battles are logged to the audit log with complete data
 */

import prisma from '../src/lib/prisma';
import { processBattle } from '../src/services/battleOrchestrator';
import { EventType, clearSequenceCache } from '../src/services/eventLogger';


describe('Battle Event Logging Integration', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testMatchIds: number[] = [];
  let scheduledMatch: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Create cycle metadata if it doesn't exist
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      create: { id: 1, totalCycles: 1 },
      update: { totalCycles: 1 },
    });

    // Create test users
    const timestamp = Date.now();
    const testUser1 = await prisma.user.create({
      data: {
        username: `testuser1_${timestamp}`,
        passwordHash: 'hash',
        currency: 100000,
        prestige: 100,
      },
    });
    testUserIds.push(testUser1.id);

    const testUser2 = await prisma.user.create({
      data: {
        username: `testuser2_${timestamp}`,
        passwordHash: 'hash',
        currency: 100000,
        prestige: 100,
      },
    });
    testUserIds.push(testUser2.id);

    // Create test robots
    const testRobot1 = await prisma.robot.create({
      data: {
        name: `TestBot1_${timestamp}`,
        userId: testUser1.id,
        currentLeague: 'bronze',
        elo: 1000,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        combatPower: 10,
        hullIntegrity: 10,
        shieldCapacity: 10,
      },
    });
    testRobotIds.push(testRobot1.id);

    const testRobot2 = await prisma.robot.create({
      data: {
        name: `TestBot2_${timestamp}`,
        userId: testUser2.id,
        currentLeague: 'bronze',
        elo: 1000,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        combatPower: 10,
        hullIntegrity: 10,
        shieldCapacity: 10,
      },
    });
    testRobotIds.push(testRobot2.id);

    // Create scheduled match
    scheduledMatch = await prisma.scheduledMatch.create({
      data: {
        robot1Id: testRobot1.id,
        robot2Id: testRobot2.id,
        leagueType: 'bronze',
        scheduledFor: new Date(),
        status: 'scheduled',
      },
    });
    testMatchIds.push(scheduledMatch.id);
  });

  afterEach(async () => {
    // Clean up test data between tests (keep users, robots, and scheduled match from beforeAll)
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.$disconnect();
  });

  it('should log battle_complete event when a battle is processed', async () => {
    // Execute the battle
    const result = await processBattle(scheduledMatch);

    // Verify battle was created
    expect(result.battleId).toBeDefined();

    // Verify events were logged (one per robot)
    const events = await prisma.auditLog.findMany({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        battleId: result.battleId,
      },
    });

    // System now creates 2 events - one for each robot's perspective
    expect(events).toHaveLength(2);

    // Both events should reference the same battle
    events.forEach(event => {
      const payload = event.payload as any;
      expect(payload.battleType).toBeDefined();
      expect(payload.result).toBeDefined(); // 'win', 'loss', or 'draw'
      expect(payload.opponentId).toBeDefined();
      expect(payload.eloBefore).toBeDefined();
      expect(payload.eloAfter).toBeDefined();
      expect(payload.eloChange).toBeDefined();
      expect(payload.damageDealt).toBeDefined();
      expect(payload.finalHP).toBeDefined();
      expect(payload.credits).toBeDefined();
      expect(payload.prestige).toBeDefined();
      expect(payload.fame).toBeDefined();
      expect(payload.streamingRevenue).toBeDefined();
      expect(payload.durationSeconds).toBeDefined();
      expect(payload.leagueType).toBe('bronze');
    });
    
    // Verify metadata
    expect(events[0].userId).toBeDefined();
    expect(events[0].robotId).toBeDefined();
    expect(events[0].sequenceNumber).toBeGreaterThan(0);
  });

  it('should maintain Battle table records alongside event logs', async () => {
    // Execute another battle
    const result = await processBattle(scheduledMatch);

    // Verify battle record still exists in Battle table
    const battle = await prisma.battle.findUnique({
      where: { id: result.battleId },
    });

    expect(battle).toBeDefined();
    
    // Query events for THIS specific battle
    const events = await prisma.auditLog.findMany({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        battleId: result.battleId,
      },
    });
    
    // System now creates 2 events - one for each robot's perspective
    expect(events).toHaveLength(2);
    
    // Verify both events reference the same battle
    events.forEach(event => {
      expect(event.battleId).toBe(result.battleId);
    });
  });
});
