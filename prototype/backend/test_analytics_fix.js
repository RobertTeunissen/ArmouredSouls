const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const userId = 2; // player2
  
  // Simulate what the fixed analytics API will return
  const cycle0Purchases = await prisma.auditLog.findMany({
    where: {
      cycleNumber: 0,
      userId,
      eventType: { in: ['weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'] },
    },
  });

  const cycle0RobotCreations = await prisma.auditLog.findMany({
    where: {
      cycleNumber: 0,
      userId,
      eventType: 'credit_change',
      payload: {
        path: ['source'],
        equals: 'other'
      }
    },
  });

  const weapons = cycle0Purchases
    .filter(e => e.eventType === 'weapon_purchase')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
  
  const facilities = cycle0Purchases
    .filter(e => e.eventType === 'facility_purchase' || e.eventType === 'facility_upgrade')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
  
  const attributes = cycle0Purchases
    .filter(e => e.eventType === 'attribute_upgrade')
    .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);

  const robots = cycle0RobotCreations
    .reduce((sum, e) => sum + Math.abs(Number(e.payload?.amount) || 0), 0);

  const total = weapons + facilities + attributes + robots;

  console.log('=== Fixed Analytics API Result ===\n');
  console.log(`Weapons: ₡${weapons.toLocaleString()}`);
  console.log(`Facilities: ₡${facilities.toLocaleString()}`);
  console.log(`Robots: ₡${robots.toLocaleString()}`);
  console.log(`Attributes: ₡${attributes.toLocaleString()}`);
  console.log(`\nTOTAL PURCHASES: ₡${total.toLocaleString()}`);
  console.log(`\n✅ This should now show in the cycle summary!`);
  
  await prisma.$disconnect();
}

test();
