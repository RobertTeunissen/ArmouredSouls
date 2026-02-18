const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCycle0Details() {
  try {
    console.log('\n=== Cycle 0 Detailed Events (User 2) ===\n');

    const cycle0Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    cycle0Events.forEach(event => {
      console.log(`\n[${event.eventType}]`);
      console.log(`  Sequence: ${event.sequenceNumber}`);
      console.log(`  Payload:`, JSON.stringify(event.payload, null, 2));
    });

    // Calculate totals
    const weaponPurchases = cycle0Events
      .filter(e => e.eventType === 'weapon_purchase')
      .reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    
    const facilityPurchases = cycle0Events
      .filter(e => e.eventType === 'facility_purchase' || e.eventType === 'facility_upgrade')
      .reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    
    const attributeUpgrades = cycle0Events
      .filter(e => e.eventType === 'attribute_upgrade')
      .reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    
    const creditChanges = cycle0Events
      .filter(e => e.eventType === 'credit_change' && e.payload?.source === 'other')
      .reduce((sum, e) => sum + Math.abs(e.payload?.amount || 0), 0);

    console.log('\n=== Totals ===');
    console.log(`Weapon Purchases: ₡${weaponPurchases.toLocaleString()}`);
    console.log(`Facility Purchases: ₡${facilityPurchases.toLocaleString()}`);
    console.log(`Attribute Upgrades: ₡${attributeUpgrades.toLocaleString()}`);
    console.log(`Credit Changes (other): ₡${creditChanges.toLocaleString()}`);
    console.log(`\nTotal: ₡${(weaponPurchases + facilityPurchases + attributeUpgrades + creditChanges).toLocaleString()}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle0Details();
