const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
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
    console.log('\n=== ALL CYCLE 0 EVENTS ===');
    const allEvents = await prisma.auditLog.findMany({
      where: { cycleNumber: 0 },
      orderBy: { sequenceNumber: 'asc' }
    });
    
    console.log(`Total events: ${allEvents.length}\n`);
    
    // Group by type
    const byType = {};
    allEvents.forEach(e => {
      if (!byType[e.eventType]) byType[e.eventType] = [];
      byType[e.eventType].push(e);
    });
    
    Object.keys(byType).sort().forEach(type => {
      console.log(`${type}: ${byType[type].length}`);
      
      // Calculate costs
      let cost = 0;
      byType[type].forEach(e => {
        if (e.payload?.cost) cost += e.payload.cost;
        if (e.eventType === 'credit_change' && e.payload?.amount < 0) {
          cost += Math.abs(e.payload.amount);
        }
      });
      
      if (cost > 0) {
        console.log(`  Total cost: ₡${cost.toLocaleString()}`);
      }
    });
    
    // Check what the analytics API would return
    console.log('\n=== WHAT ANALYTICS API SEES ===');
    const purchaseEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: player1.id,
        eventType: { in: ['weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'] },
      },
    });
    
    console.log(`Purchase events for player1: ${purchaseEvents.length}`);
    
    let weapons = 0, facilities = 0, attributes = 0;
    purchaseEvents.forEach(e => {
      const cost = e.payload?.cost || 0;
      if (e.eventType === 'weapon_purchase') weapons += cost;
      if (e.eventType === 'facility_purchase' || e.eventType === 'facility_upgrade') facilities += cost;
      if (e.eventType === 'attribute_upgrade') attributes += cost;
    });
    
    console.log(`Weapons: ₡${weapons.toLocaleString()}`);
    console.log(`Facilities: ₡${facilities.toLocaleString()}`);
    console.log(`Attributes: ₡${attributes.toLocaleString()}`);
    console.log(`TOTAL: ₡${(weapons + facilities + attributes).toLocaleString()}`);
    
    // Check credit_change events
    console.log('\n=== CREDIT_CHANGE EVENTS ===');
    const creditChanges = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: player1.id,
        eventType: 'credit_change'
      }
    });
    
    console.log(`Credit change events: ${creditChanges.length}`);
    creditChanges.forEach(e => {
      console.log(`  ${e.payload?.source}: ₡${e.payload?.amount}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
