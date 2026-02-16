/**
 * Integration test for battle event logging
 * 
 * Verifies that battles are logged to the audit log with complete data
 */

import { PrismaClient } from '@prisma/client';
import { processBattle } from '../src/services/battleOrchestrator';
import { EventType } from '../src/services/eventLogger';

const prisma = new PrismaClient();

describe('Battle Event Logging Integration', () => {
  let testUser1: any;
  let testUser2: any;
  let testRobot1: any;
  let testRobot2: any;
  let scheduledMatch: any;

  beforeAll(async () => {
    // Clean up in correct order to avoid foreign key constraints
    await prisma.auditLog.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.tagTeam.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    // Create cycle metadata if it doesn't exist
    await prisma.cycleMetadata.upsert({
      where: { id: 1 },
      create: { id: 1, totalCycles: 1 },
      update: { totalCycles: 1 },
    });

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        username: 'testuser1',
        passwordHash: 'hash',
        currency: 100000,
        prestige: 100,
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        username: 'testuser2',
        passwordHash: 'hash',
        currency: 100000,
        prestige: 100,
      },
    });

    // Create test robots
    testRobot1 = await prisma.robot.create({
      data: {
        name: 'TestBot1',
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

    testRobot2 = await prisma.robot.create({
      data: {
        name: 'TestBot2',
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should log battle_complete event when a battle is processed', async () => {
    // Execute the battle
    const result = await processBattle(scheduledMatch);

    // Verify battle was created
    expect(result.battleId).toBeDefined();

    // Verify event was logged
    const events = await prisma.auditLog.findMany({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        cycleNumber: 1,
      },
    });

    expect(events).toHaveLength(1);

    const event = events[0];
    expect(event.payload).toHaveProperty('battleId', result.battleId);
    expect(event.payload).toHaveProperty('robot1Id', testRobot1.id);
    expect(event.payload).toHaveProperty('robot2Id', testRobot2.id);
    expect(event.payload).toHaveProperty('winnerId');
    
    // Verify ELO tracking
    expect(event.payload).toHaveProperty('robot1ELOBefore');
    expect(event.payload).toHaveProperty('robot1ELOAfter');
    expect(event.payload).toHaveProperty('robot2ELOBefore');
    expect(event.payload).toHaveProperty('robot2ELOAfter');
    expect(event.payload).toHaveProperty('eloChange');
    
    // Verify damage tracking
    expect(event.payload).toHaveProperty('robot1DamageDealt');
    expect(event.payload).toHaveProperty('robot2DamageDealt');
    expect(event.payload).toHaveProperty('robot1FinalHP');
    expect(event.payload).toHaveProperty('robot2FinalHP');
    
    // Verify rewards
    expect(event.payload).toHaveProperty('winnerReward');
    expect(event.payload).toHaveProperty('loserReward');
    
    // Verify costs
    expect(event.payload).toHaveProperty('robot1RepairCost');
    expect(event.payload).toHaveProperty('robot2RepairCost');
    
    // Verify battle details
    expect(event.payload).toHaveProperty('durationSeconds');
    expect(event.payload).toHaveProperty('battleType', 'league');
    expect(event.payload).toHaveProperty('leagueType', 'bronze');
    
    // Verify metadata
    expect(event.userId).toBe(testRobot1.userId);
    expect(event.robotId).toBe(testRobot1.id);
    expect(event.sequenceNumber).toBeGreaterThan(0);
  });

  it('should maintain Battle table records alongside event logs', async () => {
    // Verify battle record still exists in Battle table
    const battles = await prisma.battle.findMany({
      where: {
        robot1Id: testRobot1.id,
        robot2Id: testRobot2.id,
      },
    });

    expect(battles).toHaveLength(1);
    
    // Verify event log also exists
    const events = await prisma.auditLog.findMany({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
      },
    });

    expect(events).toHaveLength(1);
    
    // Verify they reference the same battle
    expect(events[0].payload).toHaveProperty('battleId', battles[0].id);
  });
});
