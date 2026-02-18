const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle2Repairs() {
  try {
    console.log('\n=== Cycle 2 Audit Log (User 2) ===\n');

    const cycle2Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`Total events: ${cycle2Events.length}\n`);

    cycle2Events.forEach(event => {
      console.log(`[${event.eventType}] Seq ${event.sequenceNumber}`);
      if (event.eventType === 'robot_repair') {
        console.log(`  Robot ${event.robotId}: ₡${event.payload?.cost}, ${event.payload?.damageRepaired} HP, ${event.payload?.discountPercent}% discount`);
      } else {
        console.log(`  Payload:`, JSON.stringify(event.payload, null, 2));
      }
    });

    // Check repair events specifically
    const repairEvents = cycle2Events.filter(e => e.eventType === 'robot_repair');
    const totalRepairCost = repairEvents.reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    
    console.log(`\n=== Repair Events: ${repairEvents.length} ===`);
    console.log(`Total Repair Cost: ₡${totalRepairCost.toLocaleString()}`);
    console.log(`Expected: ₡2,365 (284 + 2,081)`);

    // Check cycle 2 snapshot
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 2 },
    });

    if (snapshot) {
      const user2Metrics = snapshot.stableMetrics.find(m => m.userId === 2);
      console.log('\n=== Cycle 2 Snapshot (User 2) ===');
      console.log(`Total Repair Costs: ₡${user2Metrics?.totalRepairCosts || 0}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle2Repairs();
