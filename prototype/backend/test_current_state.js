const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCurrentState() {
  try {
    // Get player1
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' },
      include: { robots: true }
    });
    
    console.log('=== PLAYER1 STATE ===');
    console.log(`Balance: ₡${player1.currency.toLocaleString()}`);
    console.log(`Robots: ${player1.robots.length}`);
    console.log(`Expected spending: ₡${(3000000 - player1.currency).toLocaleString()}`);
    
    // Check ALL cycle 0 events
    console.log('\n=== CYCLE 0 AUDIT LOG ===');
    const cycle0Events = await prisma.auditLog.findMany({
      where: { cycleNumber: 0 },
      orderBy: { sequenceNumber: 'asc' }
    });
    
    console.log(`Total events: ${cycle0Events.length}\n`);
    
    // Count by type
    const counts = {};
    const costs = {};
    
    cycle0Events.forEach(e => {
      counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      
      // Calculate costs
      if (e.eventType === 'weapon_purchase' || 
          e.eventType === 'facility_purchase' || 
          e.eventType === 'facility_upgrade' ||
          e.eventType === 'attribute_upgrade') {
        const cost = e.payload?.cost || 0;
        costs[e.eventType] = (costs[e.eventType] || 0) + cost;
      }
      
      if (e.eventType === 'credit_change') {
        const amount = e.payload?.amount || 0;
        const source = e.payload?.source || 'unknown';
        if (amount < 0) {
          const key = `credit_change_${source}`;
          costs[key] = (costs[key] || 0) + Math.abs(amount);
        }
      }
    });
    
    console.log('Event counts:');
    Object.keys(counts).sort().forEach(type => {
      console.log(`  ${type}: ${counts[type]}`);
    });
    
    console.log('\nCosts by type:');
    let totalCost = 0;
    Object.keys(costs).sort().forEach(type => {
      console.log(`  ${type}: ₡${costs[type].toLocaleString()}`);
      totalCost += costs[type];
    });
    
    console.log(`\nTotal logged costs: ₡${totalCost.toLocaleString()}`);
    console.log(`Expected spending: ₡${(3000000 - player1.currency).toLocaleString()}`);
    console.log(`Missing: ₡${(3000000 - player1.currency - totalCost).toLocaleString()}`);
    
    // Check if robot creations are logged
    console.log('\n=== ROBOT CREATION EVENTS ===');
    const robotCreations = cycle0Events.filter(e => 
      e.eventType === 'credit_change' && 
      (e.payload?.source === 'other' || e.payload?.source === 'robot_creation')
    );
    
    console.log(`Found ${robotCreations.length} potential robot creation events`);
    robotCreations.forEach(e => {
      console.log(`  Amount: ${e.payload?.amount}, Source: ${e.payload?.source}, UserId: ${e.userId}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCurrentState();
