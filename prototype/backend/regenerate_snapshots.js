/**
 * Regenerate cycle snapshots to include repair costs
 * Run this after fixing the repair cost aggregation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function regenerateSnapshots() {
  try {
    console.log('=== Regenerating Cycle Snapshots ===\n');

    // Get current cycle number
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    const currentCycle = cycleMetadata?.totalCycles || 0;
    console.log(`Current cycle: ${currentCycle}\n`);

    if (currentCycle === 0) {
      console.log('No cycles to regenerate');
      return;
    }

    // Import the cycle snapshot service
    const { cycleSnapshotService } = await import('./src/services/cycleSnapshotService.ts');

    // Delete existing snapshots
    console.log('Deleting existing snapshots...');
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: {
          gte: 1,
          lte: currentCycle,
        },
      },
    });
    console.log(`Deleted snapshots for cycles 1-${currentCycle}\n`);

    // Regenerate snapshots for each cycle
    for (let cycle = 1; cycle <= currentCycle; cycle++) {
      console.log(`Regenerating snapshot for cycle ${cycle}...`);
      try {
        await cycleSnapshotService.createSnapshot(cycle);
        console.log(`✓ Cycle ${cycle} snapshot created\n`);
      } catch (error) {
        console.error(`✗ Failed to create snapshot for cycle ${cycle}:`, error.message);
      }
    }

    console.log('\n=== Regeneration Complete ===');
    console.log(`Regenerated ${currentCycle} cycle snapshots`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateSnapshots();
