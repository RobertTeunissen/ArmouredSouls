const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycleSnapshots() {
  try {
    console.log('Checking cycle snapshots...\n');

    // Get cycle metadata
    const metadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });

    if (!metadata) {
      console.log('No cycle metadata found');
      return;
    }

    console.log(`Total cycles completed: ${metadata.totalCycles}`);
    console.log(`Current cycle: ${metadata.currentCycleNumber}\n`);

    // Get all snapshots
    const snapshots = await prisma.cycleSnapshot.findMany({
      orderBy: { cycleNumber: 'asc' },
      select: {
        cycleNumber: true,
        startTime: true,
        endTime: true,
        totalBattles: true,
      },
    });

    console.log(`Snapshots found: ${snapshots.length}\n`);

    if (snapshots.length > 0) {
      console.log('Snapshot details:');
      snapshots.forEach(s => {
        console.log(`  Cycle ${s.cycleNumber}: ${s.totalBattles} battles`);
      });
    }

    // Find missing snapshots
    const existingCycles = new Set(snapshots.map(s => s.cycleNumber));
    const missingCycles = [];
    for (let i = 1; i <= metadata.totalCycles; i++) {
      if (!existingCycles.has(i)) {
        missingCycles.push(i);
      }
    }

    if (missingCycles.length > 0) {
      console.log(`\nMissing snapshots for cycles: ${missingCycles.join(', ')}`);
    } else {
      console.log('\nAll cycles have snapshots!');
    }

    // Check audit logs for missing cycles
    if (missingCycles.length > 0) {
      console.log('\nChecking audit logs for missing cycles...');
      for (const cycle of missingCycles.slice(0, 5)) { // Check first 5 missing
        const startEvent = await prisma.auditLog.findFirst({
          where: { cycleNumber: cycle, eventType: 'cycle_start' },
        });
        const completeEvent = await prisma.auditLog.findFirst({
          where: { cycleNumber: cycle, eventType: 'cycle_complete' },
        });
        console.log(`  Cycle ${cycle}: start=${!!startEvent}, complete=${!!completeEvent}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycleSnapshots();
