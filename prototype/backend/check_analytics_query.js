const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const userId = 2; // player2
  
  // This is what the analytics API queries for cycle 0 purchases
  const cycle0Purchases = await prisma.auditLog.findMany({
    where: {
      cycleNumber: 0,
      userId,
      eventType: { in: ['weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'] },
    },
  });
  
  console.log('=== What Analytics API Queries ===');
  console.log(`Events found: ${cycle0Purchases.length}\n`);
  
  const weapons = cycle0Purchases
    .filter(e => e.eventType === 'weapon_purchase')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
  
  const facilities = cycle0Purchases
    .filter(e => e.eventType === 'facility_purchase' || e.eventType === 'facility_upgrade')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
  
  const attributes = cycle0Purchases
    .filter(e => e.eventType === 'attribute_upgrade')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
  
  console.log(`Weapons: ₡${weapons.toLocaleString()}`);
  console.log(`Facilities: ₡${facilities.toLocaleString()}`);
  console.log(`Attributes: ₡${attributes.toLocaleString()}`);
  console.log(`Total: ₡${(weapons + facilities + attributes).toLocaleString()}`);
  
  console.log('\n=== Missing: Robot Creations ===');
  console.log('Robot creations are logged as credit_change events with source="other"');
  console.log('They are NOT included in the purchase event types query!');
  
  const robotCreations = await prisma.auditLog.findMany({
    where: {
      cycleNumber: 0,
      userId,
      eventType: 'credit_change',
      payload: {
        path: ['source'],
        equals: 'other'
      }
    }
  });
  
  const robotCost = robotCreations.reduce((sum, e) => 
    sum + Math.abs(Number(e.payload?.amount) || 0), 0
  );
  
  console.log(`Robot creations: ${robotCreations.length} events`);
  console.log(`Robot cost: ₡${robotCost.toLocaleString()}`);
  console.log(`\nWith robots: ₡${(weapons + facilities + attributes + robotCost).toLocaleString()}`);
  
  await prisma.$disconnect();
}

check();
