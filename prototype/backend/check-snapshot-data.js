const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSnapshotData() {
  try {
    console.log('Checking snapshot data...\n');

    // Get a sample snapshot
    const snapshot = await prisma.cycleSnapshot.findFirst({
      where: { cycleNumber: 2 },
    });

    if (!snapshot) {
      console.log('No snapshot found for cycle 2');
      return;
    }

    console.log('Cycle 2 snapshot:');
    console.log('Total battles:', snapshot.totalBattles);
    console.log('Total credits:', snapshot.totalCreditsTransacted.toString());
    console.log('\nStable metrics (first 3):');
    const stableMetrics = snapshot.stableMetrics;
    if (Array.isArray(stableMetrics)) {
      stableMetrics.slice(0, 3).forEach(m => {
        console.log(`  User ${m.userId}: earned=${m.totalCreditsEarned}, repairs=${m.totalRepairCosts}, net=${m.netProfit}`);
      });
      console.log(`  Total users with data: ${stableMetrics.length}`);
    } else {
      console.log('  stableMetrics is not an array:', typeof stableMetrics);
    }

    console.log('\nRobot metrics (first 3):');
    const robotMetrics = snapshot.robotMetrics;
    if (Array.isArray(robotMetrics)) {
      robotMetrics.slice(0, 3).forEach(m => {
        console.log(`  Robot ${m.robotId}: battles=${m.battlesParticipated}, wins=${m.wins}`);
      });
      console.log(`  Total robots with data: ${robotMetrics.length}`);
    } else {
      console.log('  robotMetrics is not an array:', typeof robotMetrics);
    }

    // Check all users
    console.log('\nAll users in database:');
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
      take: 10,
    });
    users.forEach(u => {
      console.log(`  User ${u.id}: ${u.username}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSnapshotData();
