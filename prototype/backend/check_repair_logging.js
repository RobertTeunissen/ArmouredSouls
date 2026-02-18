/**
 * Check if repair events are being logged to the audit log
 * Run this after a cycle to see if repair events exist
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRepairLogging() {
  try {
    console.log('=== Checking Repair Event Logging ===\n');

    // Get current cycle number
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = cycleMetadata?.totalCycles || 0;
    console.log(`Current cycle: ${currentCycle}\n`);

    // Check last 3 cycles for repair events
    for (let cycle = Math.max(1, currentCycle - 2); cycle <= currentCycle; cycle++) {
      console.log(`--- Cycle ${cycle} ---`);

      // Get all repair events
      const repairEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber: cycle,
          eventType: 'robot_repair',
        },
        orderBy: {
          sequenceNumber: 'asc',
        },
      });

      console.log(`Found ${repairEvents.length} repair events`);

      if (repairEvents.length > 0) {
        console.log('\nRepair events:');
        for (const event of repairEvents) {
          console.log(`  - User ${event.userId}, Robot ${event.robotId}, Cost: ₡${event.payload.cost}, Sequence: ${event.sequenceNumber}`);
        }
      }

      // Get cycle snapshot
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber: cycle },
      });

      if (snapshot) {
        console.log('\nCycle snapshot repair costs:');
        const stableMetrics = snapshot.stableMetrics;
        if (Array.isArray(stableMetrics)) {
          stableMetrics.forEach(metric => {
            if (metric.totalRepairCosts > 0) {
              console.log(`  - User ${metric.userId}: ₡${metric.totalRepairCosts}`);
            }
          });
        }
      } else {
        console.log('No cycle snapshot found');
      }

      console.log('');
    }

    // Check if there are any repair events at all
    const totalRepairEvents = await prisma.auditLog.count({
      where: {
        eventType: 'robot_repair',
      },
    });

    console.log(`\nTotal repair events in database: ${totalRepairEvents}`);

    // Check all event types in the last cycle
    console.log(`\n--- All event types in Cycle ${currentCycle} ---`);
    const eventTypes = await prisma.auditLog.groupBy({
      by: ['eventType'],
      where: {
        cycleNumber: currentCycle,
      },
      _count: {
        eventType: true,
      },
    });

    eventTypes.forEach(et => {
      console.log(`  ${et.eventType}: ${et._count.eventType}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRepairLogging();
