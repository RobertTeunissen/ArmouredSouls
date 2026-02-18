/**
 * Verify that repair events are logged to the correct cycle
 * 
 * This script checks:
 * 1. What cycle number is in cycleMetadata
 * 2. What cycle number repair events are logged with
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Repair Cycle Logging Verification ===\n');

  // Get current cycle metadata
  const metadata = await prisma.cycleMetadata.findUnique({
    where: { id: 1 },
  });

  console.log(`Current cycleMetadata.totalCycles: ${metadata?.totalCycles || 0}`);
  console.log('');

  // Get all repair events
  const repairEvents = await prisma.auditLog.findMany({
    where: {
      eventType: 'robot_repair',
    },
    orderBy: [
      { cycleNumber: 'asc' },
      { eventTimestamp: 'asc' },
    ],
    select: {
      cycleNumber: true,
      eventTimestamp: true,
      userId: true,
      robotId: true,
      payload: true,
    },
  });

  console.log(`Total repair events found: ${repairEvents.length}\n`);

  // Group by cycle
  const byCycle = {};
  repairEvents.forEach(event => {
    if (!byCycle[event.cycleNumber]) {
      byCycle[event.cycleNumber] = [];
    }
    byCycle[event.cycleNumber].push(event);
  });

  // Display by cycle
  Object.keys(byCycle).sort((a, b) => Number(a) - Number(b)).forEach(cycle => {
    const events = byCycle[cycle];
    console.log(`Cycle ${cycle}: ${events.length} repair event(s)`);
    events.forEach(event => {
      const cost = event.payload?.cost || 0;
      console.log(`  - User ${event.userId}, Robot ${event.robotId}, Cost: ₡${cost.toLocaleString()}, Time: ${event.eventTimestamp.toISOString()}`);
    });
    console.log('');
  });

  // Get cycle start/complete events to show timing
  const cycleEvents = await prisma.auditLog.findMany({
    where: {
      eventType: { in: ['cycle_start', 'cycle_complete'] },
    },
    orderBy: [
      { cycleNumber: 'asc' },
      { eventTimestamp: 'asc' },
    ],
    select: {
      cycleNumber: true,
      eventType: true,
      eventTimestamp: true,
    },
  });

  console.log('=== Cycle Timing ===');
  cycleEvents.forEach(event => {
    console.log(`Cycle ${event.cycleNumber} - ${event.eventType}: ${event.eventTimestamp.toISOString()}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
