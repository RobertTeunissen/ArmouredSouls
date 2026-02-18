const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle1Snapshot() {
  try {
    console.log('\n=== Checking Cycle 1 Snapshot ===\n');

    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 1 },
    });

    if (!snapshot) {
      console.log('No snapshot found for Cycle 1');
      return;
    }

    console.log('Snapshot found for Cycle 1');
    console.log('Stable Metrics:', JSON.stringify(snapshot.stableMetrics, null, 2));

    // Check audit log for repair events
    const repairEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 1,
        eventType: 'robot_repair',
        userId: 2,
      },
    });

    console.log('\n=== Repair Events in Audit Log (Cycle 1, User 2) ===');
    console.log(`Count: ${repairEvents.length}`);
    let totalCost = 0;
    repairEvents.forEach(event => {
      const cost = event.payload.cost || 0;
      totalCost += cost;
      console.log(`  Robot ${event.robotId}: ₡${cost} (${event.payload.damageRepaired} HP, ${event.payload.discountPercent}% discount)`);
    });
    console.log(`Total: ₡${totalCost}`);

    // Check user balance
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: { currency: true },
    });

    console.log(`\n=== User Balance ===`);
    console.log(`Current: ₡${Number(user.currency).toLocaleString()}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle1Snapshot();
