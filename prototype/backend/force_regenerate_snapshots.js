/**
 * Force regenerate cycle snapshots by deleting existing ones and recreating them
 * This ensures repair costs and other metrics are properly aggregated
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceRegenerateSnapshots() {
  try {
    console.log('\n=== Force Regenerating Cycle Snapshots ===\n');

    // Get current cycle number
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    if (!cycleMetadata || cycleMetadata.totalCycles === 0) {
      console.log('No cycles to regenerate');
      return;
    }

    const totalCycles = cycleMetadata.totalCycles;
    console.log(`Total cycles: ${totalCycles}\n`);

    // Delete existing snapshots
    console.log('Deleting existing snapshots...');
    const deleteResult = await prisma.cycleSnapshot.deleteMany({});
    console.log(`Deleted ${deleteResult.count} snapshots\n`);

    // Import the service (using require for CommonJS compatibility)
    const { cycleSnapshotService } = require('./dist/services/cycleSnapshotService.js');

    // Recreate snapshots for all cycles
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      try {
        console.log(`Creating snapshot for cycle ${cycle}...`);
        await cycleSnapshotService.createSnapshot(cycle);
        console.log(`✓ Cycle ${cycle} snapshot created\n`);
      } catch (error) {
        console.error(`✗ Failed to create snapshot for cycle ${cycle}:`, error.message);
      }
    }

    console.log('=== Done ===\n');

    // Verify the snapshots
    console.log('=== Verifying Snapshots ===\n');
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      const snapshot = await prisma.cycleSnapshot.findUnique({
        where: { cycleNumber: cycle },
      });

      if (snapshot) {
        const user2Metrics = snapshot.stableMetrics.find(m => m.userId === 2);
        if (user2Metrics) {
          console.log(`Cycle ${cycle} (User 2):`);
          console.log(`  Repair Costs: ₡${user2Metrics.totalRepairCosts.toLocaleString()}`);
          console.log(`  Operating Costs: ₡${user2Metrics.operatingCosts.toLocaleString()}`);
          console.log(`  Credits Earned: ₡${user2Metrics.totalCreditsEarned.toLocaleString()}`);
          console.log(`  Net Profit: ₡${user2Metrics.netProfit.toLocaleString()}\n`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

forceRegenerateSnapshots();
