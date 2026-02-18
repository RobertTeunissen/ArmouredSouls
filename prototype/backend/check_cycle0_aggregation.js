const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle0Aggregation() {
  try {
    const userId = 2; // player1
    
    // This is what the analytics API queries
    const cycle0Purchases = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId,
        eventType: { in: ['weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'] },
      },
    });
    
    console.log('=== Cycle 0 Purchase Events (for analytics API) ===\n');
    console.log(`Total events: ${cycle0Purchases.length}\n`);
    
    const weaponPurchases = cycle0Purchases
      .filter(e => e.eventType === 'weapon_purchase')
      .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
    
    const facilityPurchases = cycle0Purchases
      .filter(e => e.eventType === 'facility_purchase' || e.eventType === 'facility_upgrade')
      .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
    
    const attributeUpgrades = cycle0Purchases
      .filter(e => e.eventType === 'attribute_upgrade')
      .reduce((sum, e) => sum + (Number(e.payload?.cost) || 0), 0);
    
    console.log(`Weapon purchases: ₡${weaponPurchases.toLocaleString()}`);
    console.log(`Facility purchases: ₡${facilityPurchases.toLocaleString()}`);
    console.log(`Attribute upgrades: ₡${attributeUpgrades.toLocaleString()}`);
    console.log(`Total: ₡${(weaponPurchases + facilityPurchases + attributeUpgrades).toLocaleString()}`);
    
    // Now check credit_change events for robot creation
    const robotCreations = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId,
        eventType: 'credit_change',
        payload: {
          path: ['source'],
          equals: 'robot_creation'
        }
      }
    });
    
    console.log(`\nRobot creation events: ${robotCreations.length}`);
    const robotCost = robotCreations.reduce((sum, e) => 
      sum + Math.abs(Number(e.payload?.amount) || 0), 0
    );
    console.log(`Robot creation cost: ₡${robotCost.toLocaleString()}`);
    
    console.log(`\nGrand total: ₡${(weaponPurchases + facilityPurchases + attributeUpgrades + robotCost).toLocaleString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle0Aggregation();
