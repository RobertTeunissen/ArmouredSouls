const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle0Purchases() {
  try {
    // Get player1's userId
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' }
    });
    
    if (!player1) {
      console.log('Player1 not found');
      return;
    }
    
    console.log(`Player1 userId: ${player1.id}`);
    console.log(`Current balance: ₡${player1.currency.toLocaleString()}`);
    console.log('\n=== Cycle 0 Events ===\n');
    
    // Get all cycle 0 events for player1
    const cycle0Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: player1.id,
      },
      orderBy: { sequenceNumber: 'asc' }
    });
    
    console.log(`Total cycle 0 events: ${cycle0Events.length}\n`);
    
    // Group by event type
    const eventsByType = {};
    let totalCost = 0;
    
    cycle0Events.forEach(event => {
      if (!eventsByType[event.eventType]) {
        eventsByType[event.eventType] = [];
      }
      eventsByType[event.eventType].push(event);
      
      const cost = event.payload?.cost || 0;
      if (cost > 0) {
        totalCost += cost;
      }
    });
    
    // Display by type
    Object.keys(eventsByType).sort().forEach(type => {
      const events = eventsByType[type];
      console.log(`${type}: ${events.length} events`);
      
      if (type.includes('purchase') || type.includes('upgrade')) {
        const typeCost = events.reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
        console.log(`  Total cost: ₡${typeCost.toLocaleString()}`);
        
        // Show first few events
        events.slice(0, 3).forEach(e => {
          console.log(`    - ${JSON.stringify(e.payload)}`);
        });
        if (events.length > 3) {
          console.log(`    ... and ${events.length - 3} more`);
        }
      }
      console.log('');
    });
    
    console.log(`\nTotal cost from cycle 0 events: ₡${totalCost.toLocaleString()}`);
    
    // Check for robot purchases (might not have userId)
    console.log('\n=== Checking Robot-related Events ===\n');
    
    const robots = await prisma.robot.findMany({
      where: { userId: player1.id },
      select: { id: true, name: true }
    });
    
    console.log(`Player1 has ${robots.length} robots`);
    
    for (const robot of robots) {
      const robotEvents = await prisma.auditLog.findMany({
        where: {
          cycleNumber: 0,
          robotId: robot.id,
        }
      });
      
      if (robotEvents.length > 0) {
        console.log(`\nRobot ${robot.name} (ID: ${robot.id}): ${robotEvents.length} events`);
        robotEvents.forEach(e => {
          console.log(`  - ${e.eventType}: ${JSON.stringify(e.payload)}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle0Purchases();
