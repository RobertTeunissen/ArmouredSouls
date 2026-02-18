const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCyclesAvailable() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  AVAILABLE CYCLES AND PLAYER1 DATA');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get player1
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' }
    });

    if (!player1) {
      console.log('❌ player1 not found');
      return;
    }

    console.log(`User: ${player1.username} (ID: ${player1.id})\n`);

    // Check cycle snapshots
    const snapshots = await prisma.cycleSnapshot.findMany({
      orderBy: { cycleNumber: 'asc' }
    });

    console.log(`Total cycle snapshots: ${snapshots.length}\n`);

    if (snapshots.length > 0) {
      console.log('Available cycles:');
      snapshots.forEach(s => {
        console.log(`  Cycle ${s.cycleNumber}: ${s.startTime} to ${s.endTime}`);
        
        // Check if player1 has data in this cycle
        if (Array.isArray(s.stableMetrics)) {
          const playerMetrics = s.stableMetrics.find(m => m.userId === player1.id);
          if (playerMetrics) {
            console.log(`    → Player1 data found:`);
            console.log(`       Battles: ${playerMetrics.battlesParticipated}`);
            console.log(`       Repair costs: ₡${playerMetrics.totalRepairCosts?.toLocaleString() || 0}`);
            console.log(`       Credits earned: ₡${playerMetrics.totalCreditsEarned?.toLocaleString() || 0}`);
          }
        }
      });
      console.log();
    }

    // Check audit log for battle_complete events
    const battleEventsByCycle = await prisma.auditLog.groupBy({
      by: ['cycleNumber'],
      where: {
        eventType: 'battle_complete'
      },
      _count: {
        id: true
      },
      orderBy: {
        cycleNumber: 'asc'
      }
    });

    console.log('Battle events by cycle (from audit log):');
    battleEventsByCycle.forEach(c => {
      console.log(`  Cycle ${c.cycleNumber}: ${c._count.id} battles`);
    });
    console.log();

    // Check if player1 has any battle events
    const player1Robots = await prisma.robot.findMany({
      where: { userId: player1.id },
      select: { id: true, name: true }
    });

    console.log(`Player1's robots: ${player1Robots.map(r => r.name).join(', ')}\n`);

    const robotIdSet = new Set(player1Robots.map(r => r.id));

    // Check each cycle for player1 battles
    for (const snapshot of snapshots) {
      const battleEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber: snapshot.cycleNumber,
          eventType: 'battle_complete',
        }
      });

      const playerBattles = battleEvents.filter(e => {
        const p = e.payload;
        return robotIdSet.has(p.robot1Id) || robotIdSet.has(p.robot2Id);
      });

      if (playerBattles.length > 0) {
        console.log(`Cycle ${snapshot.cycleNumber}: ${playerBattles.length} battles involving player1's robots`);
        
        // Calculate repair costs for this cycle
        let totalRepairs = 0;
        playerBattles.forEach(e => {
          const p = e.payload;
          if (robotIdSet.has(p.robot1Id)) {
            totalRepairs += p.robot1RepairCost || 0;
          }
          if (robotIdSet.has(p.robot2Id)) {
            totalRepairs += p.robot2RepairCost || 0;
          }
        });
        
        console.log(`  Total repair costs: ₡${totalRepairs.toLocaleString()}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCyclesAvailable();
