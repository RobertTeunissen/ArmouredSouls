/**
 * Simple verification script to check migrated battle events
 */

import prisma from '../lib/prisma';

(async () => {
  try {
    // Get a sample of migrated events
    const events = await prisma.auditLog.findMany({
      where: { eventType: 'battle_complete' },
      take: 3,
      orderBy: { id: 'asc' },
    });
    
    console.log('Sample migrated battle events:');
    console.log('');
    
    events.forEach((event, idx) => {
      const payload = event.payload as any;
      console.log(`Event ${idx + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Cycle: ${event.cycleNumber}`);
      console.log(`  Sequence: ${event.sequenceNumber}`);
      console.log(`  Timestamp: ${event.eventTimestamp}`);
      console.log(`  Battle ID: ${payload.battleId}`);
      console.log(`  Robot 1: ${payload.robot1Id} (ELO: ${payload.robot1ELOBefore} -> ${payload.robot1ELOAfter})`);
      console.log(`  Robot 2: ${payload.robot2Id} (ELO: ${payload.robot2ELOBefore} -> ${payload.robot2ELOAfter})`);
      console.log(`  Winner: ${payload.winnerId || 'Draw'}`);
      console.log(`  Damage: R1=${payload.robot1DamageDealt}, R2=${payload.robot2DamageDealt}`);
      console.log('');
    });
    
    // Get counts
    const battleCount = await prisma.battle.count();
    const eventCount = await prisma.auditLog.count({
      where: { eventType: 'battle_complete' },
    });
    
    console.log('Summary:');
    console.log(`  Total battles: ${battleCount}`);
    console.log(`  Total battle events: ${eventCount}`);
    console.log(`  Match: ${battleCount === eventCount ? '✓' : '✗'}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
