const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Handle BigInt serialization
BigInt.prototype.toJSON = function() { return this.toString(); };

async function checkAuditEvents() {
  try {
    console.log('Checking audit events for cycle 2...\n');

    // Check battle_complete events
    const battleEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        eventType: 'battle_complete',
      },
      take: 3,
    });

    console.log(`battle_complete events: ${battleEvents.length}`);
    if (battleEvents.length > 0) {
      console.log('Sample event:');
      console.log('  battleId:', battleEvents[0].payload?.battleId);
      console.log('  payload:', battleEvents[0].payload);
    }

    // Check passive_income events
    const passiveEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        eventType: 'passive_income',
      },
      take: 3,
    });

    console.log(`\npassive_income events: ${passiveEvents.length}`);
    if (passiveEvents.length > 0) {
      console.log('Sample event:');
      console.log('  userId:', passiveEvents[0].userId);
      console.log('  payload:', passiveEvents[0].payload);
    }

    // Check operating_costs events
    const costsEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        eventType: 'operating_costs',
      },
      take: 3,
    });

    console.log(`\noperating_costs events: ${costsEvents.length}`);
    if (costsEvents.length > 0) {
      console.log('Sample event:');
      console.log('  userId:', costsEvents[0].userId);
      console.log('  payload:', costsEvents[0].payload);
    }

    // Check battles table directly
    const battles = await prisma.battle.findMany({
      where: { cycleNumber: 2 },
      take: 3,
      include: {
        robot1: { select: { userId: true, name: true } },
        robot2: { select: { userId: true, name: true } },
      },
    });

    console.log(`\nBattles in cycle 2 (from Battle table): ${battles.length}`);
    if (battles.length > 0) {
      const b = battles[0];
      console.log('Sample battle:');
      console.log(`  Battle ${b.id}: ${b.robot1.name} (user ${b.robot1.userId}) vs ${b.robot2.name} (user ${b.robot2.userId})`);
      console.log(`  Winner: robot ${b.winnerId}, Rewards: ${b.winnerReward}/${b.loserReward}`);
      console.log(`  Repair costs: ${b.robot1RepairCost}/${b.robot2RepairCost}`);
    }

    // Now simulate what aggregateStableMetrics does
    console.log('\n--- Simulating aggregateStableMetrics logic ---');
    const battleIds = battleEvents.map(e => e.payload?.battleId).filter(Boolean);
    console.log(`Battle IDs from events: ${battleIds.length}`);
    console.log(`Battle IDs: ${battleIds.slice(0, 5).join(', ')}`);

    const battlesFromIds = await prisma.battle.findMany({
      where: { id: { in: battleIds } },
      include: {
        robot1: { select: { userId: true } },
        robot2: { select: { userId: true } },
      },
    });

    console.log(`Battles found from IDs: ${battlesFromIds.length}`);
    
    const userIds = new Set();
    battlesFromIds.forEach(b => {
      userIds.add(b.robot1.userId);
      userIds.add(b.robot2.userId);
    });
    console.log(`Unique users from battles: ${userIds.size}`);
    console.log(`User IDs: ${Array.from(userIds).slice(0, 10).join(', ')}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAuditEvents();
