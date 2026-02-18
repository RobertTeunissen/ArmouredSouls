const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle1Repairs() {
  try {
    console.log('\n=== Checking Cycle 1 Repair Events ===\n');

    const repairEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 1,
        eventType: 'robot_repair',
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`Total repair events in Cycle 1: ${repairEvents.length}\n`);

    let totalCost = 0;
    const byUser = {};

    repairEvents.forEach(event => {
      const userId = event.userId;
      const payload = event.payload;
      const cost = payload.cost || 0;
      
      if (!byUser[userId]) {
        byUser[userId] = {
          count: 0,
          totalCost: 0,
          events: [],
        };
      }
      
      byUser[userId].count++;
      byUser[userId].totalCost += cost;
      byUser[userId].events.push({
        robotId: event.robotId,
        cost,
        damageRepaired: payload.damageRepaired,
        discount: payload.discountPercent,
      });
      
      totalCost += cost;
    });

    console.log('=== By User ===\n');
    Object.keys(byUser).forEach(userId => {
      const data = byUser[userId];
      console.log(`User ${userId}:`);
      console.log(`  Repairs: ${data.count}`);
      console.log(`  Total Cost: ₡${data.totalCost.toLocaleString()}`);
      data.events.forEach(e => {
        console.log(`    Robot ${e.robotId}: ₡${e.cost.toLocaleString()} (${e.damageRepaired} HP, ${e.discount}% discount)`);
      });
      console.log('');
    });

    console.log(`\n=== Total Repair Cost (All Users): ₡${totalCost.toLocaleString()} ===\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle1Repairs();
