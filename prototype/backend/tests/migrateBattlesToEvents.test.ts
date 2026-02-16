/**
 * Tests for Battle to Event Log Migration Script
 * 
 * Validates migration correctness, data integrity, and error handling.
 */

import prisma from '../src/lib/prisma';
import { migrateBattlesToEvents, verifyMigration } from '../src/scripts/migrateBattlesToEvents';
import { EventType } from '../src/services/eventLogger';

describe('Battle to Event Log Migration', () => {
  // Clean up test data
  beforeEach(async () => {
    // Delete test audit logs
    await prisma.auditLog.deleteMany({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });
  });

  afterEach(async () => {
    // Clean up after tests
    await prisma.auditLog.deleteMany({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });
  });

  it('should handle empty database gracefully', async () => {
    // Delete all battles temporarily
    const existingBattles = await prisma.battle.findMany();
    await prisma.battle.deleteMany({});

    const stats = await migrateBattlesToEvents({ dryRun: false });

    expect(stats.totalBattles).toBe(0);
    expect(stats.migratedBattles).toBe(0);
    expect(stats.skippedBattles).toBe(0);
    expect(stats.errors).toHaveLength(0);

    // Restore battles
    for (const battle of existingBattles) {
      await prisma.battle.create({ data: battle as any });
    }
  });

  it('should migrate existing battles to audit log', async () => {
    // Get existing battles
    const battles = await prisma.battle.findMany({ take: 5 });

    if (battles.length === 0) {
      console.log('No battles to test migration - skipping test');
      return;
    }

    // Run migration
    const stats = await migrateBattlesToEvents({ dryRun: false });

    expect(stats.totalBattles).toBeGreaterThan(0);
    expect(stats.migratedBattles).toBeGreaterThan(0);
    expect(stats.errors).toHaveLength(0);

    // Verify events were created
    const events = await prisma.auditLog.findMany({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });

    expect(events.length).toBe(stats.migratedBattles);

    // Verify first event has correct structure
    const firstEvent = events[0];
    expect(firstEvent.cycleNumber).toBeGreaterThan(0);
    expect(firstEvent.sequenceNumber).toBeGreaterThan(0);
    expect(firstEvent.payload).toBeDefined();
    expect(firstEvent.payload).toHaveProperty('battleId');
    expect(firstEvent.payload).toHaveProperty('robot1Id');
    expect(firstEvent.payload).toHaveProperty('robot2Id');
  });

  it('should preserve all battle data in event payload', async () => {
    const battle = await prisma.battle.findFirst();

    if (!battle) {
      console.log('No battles to test - skipping test');
      return;
    }

    // Run migration
    await migrateBattlesToEvents({ dryRun: false });

    // Find the migrated event
    const event = await prisma.auditLog.findFirst({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        payload: {
          path: ['battleId'],
          equals: battle.id,
        },
      },
    });

    expect(event).toBeDefined();
    expect(event!.payload).toMatchObject({
      battleId: battle.id,
      robot1Id: battle.robot1Id,
      robot2Id: battle.robot2Id,
      winnerId: battle.winnerId,
      robot1ELOBefore: battle.robot1ELOBefore,
      robot1ELOAfter: battle.robot1ELOAfter,
      robot2ELOBefore: battle.robot2ELOBefore,
      robot2ELOAfter: battle.robot2ELOAfter,
      eloChange: battle.eloChange,
      robot1DamageDealt: battle.robot1DamageDealt,
      robot2DamageDealt: battle.robot2DamageDealt,
      battleType: battle.battleType,
      leagueType: battle.leagueType,
    });
  });

  it('should skip already migrated battles', async () => {
    // Run migration twice
    const stats1 = await migrateBattlesToEvents({ dryRun: false });
    const stats2 = await migrateBattlesToEvents({ dryRun: false });

    expect(stats2.migratedBattles).toBe(0);
    expect(stats2.skippedBattles).toBe(stats1.migratedBattles);
  });

  it('should assign unique sequence numbers per cycle', async () => {
    await migrateBattlesToEvents({ dryRun: false });

    // Get all events grouped by cycle
    const events = await prisma.auditLog.findMany({
      where: { eventType: EventType.BATTLE_COMPLETE },
      orderBy: [{ cycleNumber: 'asc' }, { sequenceNumber: 'asc' }],
    });

    // Check sequence numbers are unique within each cycle
    const cycleSequences = new Map<number, Set<number>>();

    for (const event of events) {
      if (!cycleSequences.has(event.cycleNumber)) {
        cycleSequences.set(event.cycleNumber, new Set());
      }

      const sequences = cycleSequences.get(event.cycleNumber)!;
      expect(sequences.has(event.sequenceNumber)).toBe(false);
      sequences.add(event.sequenceNumber);
    }
  });

  it('should preserve event timestamps from battle creation dates', async () => {
    const battle = await prisma.battle.findFirst();

    if (!battle) {
      console.log('No battles to test - skipping test');
      return;
    }

    await migrateBattlesToEvents({ dryRun: false });

    const event = await prisma.auditLog.findFirst({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        payload: {
          path: ['battleId'],
          equals: battle.id,
        },
      },
    });

    expect(event).toBeDefined();
    expect(event!.eventTimestamp.getTime()).toBe(battle.createdAt.getTime());
  });

  it('should handle dry run mode without making changes', async () => {
    const beforeCount = await prisma.auditLog.count({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });

    const stats = await migrateBattlesToEvents({ dryRun: true });

    const afterCount = await prisma.auditLog.count({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });

    expect(afterCount).toBe(beforeCount);
    expect(stats.totalBattles).toBeGreaterThanOrEqual(0);
  });

  it('should verify migration integrity', async () => {
    await migrateBattlesToEvents({ dryRun: false });

    const result = await verifyMigration();

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect missing events during verification', async () => {
    // Migrate battles
    await migrateBattlesToEvents({ dryRun: false });

    // Delete one event to simulate missing data
    const event = await prisma.auditLog.findFirst({
      where: { eventType: EventType.BATTLE_COMPLETE },
    });

    if (event) {
      await prisma.auditLog.delete({ where: { id: event.id } });

      const result = await verifyMigration();

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('should handle tag team battle data correctly', async () => {
    // Find a tag team battle if one exists
    const tagTeamBattle = await prisma.battle.findFirst({
      where: { battleType: 'tag_team' },
    });

    if (!tagTeamBattle) {
      console.log('No tag team battles to test - skipping test');
      return;
    }

    await migrateBattlesToEvents({ dryRun: false });

    const event = await prisma.auditLog.findFirst({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        payload: {
          path: ['battleId'],
          equals: tagTeamBattle.id,
        },
      },
    });

    expect(event).toBeDefined();
    expect(event!.payload).toHaveProperty('team1ActiveRobotId');
    expect(event!.payload).toHaveProperty('team1ReserveRobotId');
    expect(event!.payload).toHaveProperty('team1ActiveDamageDealt');
    expect(event!.payload).toHaveProperty('team1ReserveDamageDealt');
  });

  it('should handle tournament battle data correctly', async () => {
    // Find a tournament battle if one exists
    const tournamentBattle = await prisma.battle.findFirst({
      where: { battleType: 'tournament' },
    });

    if (!tournamentBattle) {
      console.log('No tournament battles to test - skipping test');
      return;
    }

    await migrateBattlesToEvents({ dryRun: false });

    const event = await prisma.auditLog.findFirst({
      where: {
        eventType: EventType.BATTLE_COMPLETE,
        payload: {
          path: ['battleId'],
          equals: tournamentBattle.id,
        },
      },
    });

    expect(event).toBeDefined();
    expect(event!.payload).toHaveProperty('tournamentId');
    expect(event!.payload).toHaveProperty('tournamentRound');
  });
});
