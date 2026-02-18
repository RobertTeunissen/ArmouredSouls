const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttributeUpgrades() {
  try {
    console.log('\n=== Checking ALL Audit Log Events (User 2, Cycle 0) ===\n');

    const allEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`Total events: ${allEvents.length}\n`);

    let totalSpent = 0;
    allEvents.forEach(event => {
      let cost = 0;
      if (event.eventType === 'facility_purchase' || event.eventType === 'facility_upgrade') {
        cost = event.payload?.cost || 0;
      } else if (event.eventType === 'weapon_purchase') {
        cost = event.payload?.cost || 0;
      } else if (event.eventType === 'attribute_upgrade') {
        cost = event.payload?.cost || 0;
      } else if (event.eventType === 'credit_change' && event.payload?.source === 'other') {
        cost = Math.abs(event.payload?.amount || 0);
      }
      
      if (cost > 0) {
        totalSpent += cost;
        console.log(`[${event.eventType}] Seq ${event.sequenceNumber}: ₡${cost.toLocaleString()}`);
      }
    });

    console.log(`\n=== Total Spent: ₡${totalSpent.toLocaleString()} ===`);
    console.log(`=== Expected: ₡2,984,000 (3,000,000 - 16,000) ===`);
    console.log(`=== Difference: ₡${(2984000 - totalSpent).toLocaleString()} ===`);

    // Check for attribute_upgrade events specifically
    const attributeUpgrades = allEvents.filter(e => e.eventType === 'attribute_upgrade');
    console.log(`\n=== Attribute Upgrade Events: ${attributeUpgrades.length} ===`);
    
    if (attributeUpgrades.length > 0) {
      let totalAttributeCost = 0;
      attributeUpgrades.forEach(event => {
        const cost = event.payload?.cost || 0;
        totalAttributeCost += cost;
        console.log(`  Robot ${event.robotId}: ${event.payload?.attribute} ${event.payload?.fromLevel} → ${event.payload?.toLevel}, ₡${cost.toLocaleString()}`);
      });
      console.log(`  Total: ₡${totalAttributeCost.toLocaleString()}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAttributeUpgrades();
