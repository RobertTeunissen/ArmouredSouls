const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recreateSnapshots() {
  try {
    console.log('=== Recreating Cycle Snapshots ===\n');

    // Get total cycles
    const metadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });

    if (!metadata) {
      console.log('No cycle metadata found');
      return;
    }

    const totalCycles = metadata.totalCycles;
    console.log(`Total cycles: ${totalCycles}\n`);

    // Delete existing snapshots
    const deleted = await prisma.cycleSnapshot.deleteMany({});
    console.log(`Deleted ${deleted.count} existing snapshots\n`);

    // Import the service
    const { cycleSnapshotService } = await import('./dist/services/cycleSnapshotService.js');

    // Recreate snapshots for all cycles
    const results = [];
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      try {
        console.log(`Creating snapshot for cycle ${cycle}...`);
        await cycleSnapshotService.createSnapshot(cycle);
        results.push({ cycle, status: 'success' });
      } catch (error) {
        console.error(`Failed to create snapshot for cycle ${cycle}:`, error.message);
        results.push({ cycle, status: 'failed', error: error.message });
      }
    }

    console.log('\n=== Summary ===');
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\nFailed cycles:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  Cycle ${r.cycle}: ${r.error}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recreateSnapshots();
