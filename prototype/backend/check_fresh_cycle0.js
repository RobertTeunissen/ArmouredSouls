const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFreshCycle0() {
  try {
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' },
      include: {
        robots: { select: { id: true, name: true } }
      }
    });
    
    if (!player1) {
      console.log('Player1 not found');
      return;
    }
    
    console.log(`Player1 balance: ₡${player1.currency.toLocaleString()}`);
    console.log(`Expected spending: ₡${(3000000 - player1.currency).toLocaleString()}`);
    console.log(`Robots: ${player1.robots.length}`);
    console.log('');
    
    // Get ALL cycle 0 events
    const cycle0Events = await prisma.auditLog.findMany({
      where: { cycleNumber: 0 },
      orderBy: { sequenceNumber: 'asc' }
    });
    
    console.log(`Total cycle 0 events: ${cycle0Events.length}\n`);
    
    // Group by type and calculate costs
    const summary = {};
    
    cycle0Events.forEach(e => {
      if (!summary[e.eventType]) {
        summary[e.eventType] = { count: 0, totalCost: 0, events: [] };
      }
      summary[e.eventType].count++;
      
      const cost = e.payload?.cost || 0;
      if (cost > 0) {
        summary[e.eventType].totalCost += cost;
      }
      
      // Track credit_change amounts
      if (e.eventType === 'credit_change') {
        const amount = e.payload?.amount || 0;
        if (amount < 0) {
          summary[e.eventType].totalCost += Math.abs(amount);
        }
      }
      
      summary[e.eventType].events.push(e);
    });
    
    // Display summary
    console.log('=== Event Summary ===\n');
    let totalSpending = 0;
    
    Object.keys(summary).sort().forEach(type => {
      const data = summary[type];
      console.log(`${type}: ${data.count} events`);
      
      if (data.totalCost > 0) {
        console.log(`  Cost: ₡${data.totalCost.toLocaleString()}`);
        totalSpending += data.totalCost;
        
        // Show sample
        data.events.slice(0, 2).forEach(e => {
          if (e.eventType === 'credit_change') {
            console.log(`    - amount: ${e.payload?.amount}, source: ${e.payload?.source}`);
          } else {
            console.log(`    - ${JSON.stringify(e.payload).substring(0, 100)}`);
          }
        });
      }
      console.log('');
    });
    
    console.log(`Total logged spending: ₡${totalSpending.toLocaleString()}`);
    console.log(`Expected spending: ₡${(3000000 - player1.currency).toLocaleString()}`);
    console.log(`Difference: ₡${Math.abs(totalSpending - (3000000 - player1.currency)).toLocaleString()}`);
    
    // Check for robot-related events
    console.log('\n=== Robot Events ===\n');
    const robotIds = player1.robots.map(r => r.id);
    const robotEvents = cycle0Events.filter(e => robotIds.includes(e.robotId));
    console.log(`Events with robotId: ${robotEvents.length}`);
    
    robotEvents.forEach(e => {
      console.log(`  - ${e.eventType}: ${JSON.stringify(e.payload)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFreshCycle0();
