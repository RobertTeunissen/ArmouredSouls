const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

BigInt.prototype.toJSON = function() { return this.toString(); };

async function checkCycle21() {
  try {
    console.log('Checking cycle 21 data...\n');

    // Check audit log events
    const events = await prisma.auditLog.groupBy({
      by: ['eventType'],
      where: { cycleNumber: 21 },
      _count: true,
    });

    console.log('Audit log events for cycle 21:');
    events.forEach(e => {
      console.log(`  ${e.eventType}: ${e._count}`);
    });

    // Check passive_income events
    const passiveEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 21,
        eventType: 'passive_income',
      },
      take: 3,
    });

    console.log(`\nPassive income events: ${passiveEvents.length}`);
    if (passiveEvents.length > 0) {
      console.log('Sample:', JSON.stringify(passiveEvents[0], null, 2));
    }

    // Check operating_costs events
    const costsEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 21,
        eventType: 'operating_costs',
      },
      take: 3,
    });

    console.log(`\nOperating costs events: ${costsEvents.length}`);
    if (costsEvents.length > 0) {
      console.log('Sample:', JSON.stringify(costsEvents[0], null, 2));
    }

    // Check snapshot
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 21 },
    });

    if (snapshot) {
      console.log('\nCycle 21 snapshot exists:');
      console.log('  Total battles:', snapshot.totalBattles);
      console.log('  Stable metrics count:', Array.isArray(snapshot.stableMetrics) ? snapshot.stableMetrics.length : 'N/A');
      
      if (Array.isArray(snapshot.stableMetrics) && snapshot.stableMetrics.length > 0) {
        console.log('\nFirst user in stable metrics:');
        const firstUser = snapshot.stableMetrics[0];
        console.log('  User ID:', firstUser.userId);
        console.log('  Battles:', firstUser.battlesParticipated);
        console.log('  Credits earned:', firstUser.totalCreditsEarned);
        console.log('  Merchandising:', firstUser.merchandisingIncome);
        console.log('  Streaming:', firstUser.streamingIncome);
        console.log('  Operating costs:', firstUser.operatingCosts);
        console.log('  Net profit:', firstUser.netProfit);
      }
    } else {
      console.log('\nNo snapshot found for cycle 21');
    }

    // Check user facilities
    console.log('\nChecking user facilities (first 3 users):');
    const users = await prisma.user.findMany({
      where: {
        NOT: { username: 'bye_robot_user' },
      },
      take: 3,
      include: {
        facilities: true,
      },
    });

    users.forEach(u => {
      console.log(`\nUser ${u.id} (${u.username}):`);
      console.log(`  Currency: ₡${u.currency}`);
      console.log(`  Prestige: ${u.prestige}`);
      console.log(`  Facilities: ${u.facilities.length}`);
      u.facilities.forEach(f => {
        console.log(`    - ${f.facilityType} (Level ${f.level})`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle21();
