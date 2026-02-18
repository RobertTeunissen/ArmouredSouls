const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSnapshots() {
  try {
    console.log('\n=== CYCLE 1 DEBUG ===\n');

    // Check snapshot
    const cycle1Snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 1 },
    });

    if (cycle1Snapshot) {
      const user2Metrics = cycle1Snapshot.stableMetrics.find(m => m.userId === 2);
      console.log('Cycle 1 Snapshot (User 2):');
      console.log(JSON.stringify(user2Metrics, null, 2));
    }

    // Check audit log events for cycle 1
    const cycle1Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 1,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log('\n=== Cycle 1 Audit Log Events (User 2) ===');
    console.log(`Total events: ${cycle1Events.length}\n`);

    const eventSummary = {};
    cycle1Events.forEach(event => {
      if (!eventSummary[event.eventType]) {
        eventSummary[event.eventType] = { count: 0, totalCost: 0 };
      }
      eventSummary[event.eventType].count++;
      
      const cost = event.payload?.cost || 0;
      eventSummary[event.eventType].totalCost += cost;
    });

    Object.keys(eventSummary).forEach(type => {
      console.log(`${type}: ${eventSummary[type].count} events, ₡${eventSummary[type].totalCost.toLocaleString()} total`);
    });

    // Check cycle 0 events (purchases before first cycle)
    const cycle0Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log('\n=== Cycle 0 Audit Log Events (User 2) ===');
    console.log(`Total events: ${cycle0Events.length}\n`);

    const cycle0Summary = {};
    let totalPurchases = 0;
    cycle0Events.forEach(event => {
      if (!cycle0Summary[event.eventType]) {
        cycle0Summary[event.eventType] = { count: 0, totalCost: 0 };
      }
      cycle0Summary[event.eventType].count++;
      
      const cost = event.payload?.cost || 0;
      cycle0Summary[event.eventType].totalCost += cost;
      
      if (['weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'].includes(event.eventType)) {
        totalPurchases += cost;
      }
    });

    Object.keys(cycle0Summary).forEach(type => {
      console.log(`${type}: ${cycle0Summary[type].count} events, ₡${cycle0Summary[type].totalCost.toLocaleString()} total`);
    });
    console.log(`\nTotal Cycle 0 Purchases: ₡${totalPurchases.toLocaleString()}`);

    console.log('\n=== CYCLE 2 DEBUG ===\n');

    // Check snapshot
    const cycle2Snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 2 },
    });

    if (cycle2Snapshot) {
      const user2Metrics = cycle2Snapshot.stableMetrics.find(m => m.userId === 2);
      console.log('Cycle 2 Snapshot (User 2):');
      console.log(JSON.stringify(user2Metrics, null, 2));
    }

    // Check audit log events for cycle 2
    const cycle2Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log('\n=== Cycle 2 Audit Log Events (User 2) ===');
    console.log(`Total events: ${cycle2Events.length}\n`);

    const cycle2EventSummary = {};
    cycle2Events.forEach(event => {
      if (!cycle2EventSummary[event.eventType]) {
        cycle2EventSummary[event.eventType] = { count: 0, totalCost: 0 };
      }
      cycle2EventSummary[event.eventType].count++;
      
      const cost = event.payload?.cost || 0;
      cycle2EventSummary[event.eventType].totalCost += cost;
    });

    Object.keys(cycle2EventSummary).forEach(type => {
      console.log(`${type}: ${cycle2EventSummary[type].count} events, ₡${cycle2EventSummary[type].totalCost.toLocaleString()} total`);
    });

    // Check user balance
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: { currency: true },
    });

    console.log(`\n=== User Balance ===`);
    console.log(`Current: ₡${Number(user.currency).toLocaleString()}`);

    // Calculate expected balance
    console.log('\n=== Expected Balance Calculation ===');
    console.log('Starting: ₡3,000,000');
    console.log(`Cycle 0 Purchases: -₡${totalPurchases.toLocaleString()}`);
    console.log(`After Cycle 0: ₡${(3000000 - totalPurchases).toLocaleString()}`);
    
    const cycle1Repairs = cycle1Events.filter(e => e.eventType === 'robot_repair').reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    const cycle1Operating = cycle1Events.filter(e => e.eventType === 'operating_costs').reduce((sum, e) => sum + (e.payload?.totalCost || 0), 0);
    console.log(`Cycle 1 Repairs: -₡${cycle1Repairs.toLocaleString()}`);
    console.log(`Cycle 1 Operating: -₡${cycle1Operating.toLocaleString()}`);
    console.log(`After Cycle 1: ₡${(3000000 - totalPurchases - cycle1Repairs - cycle1Operating).toLocaleString()}`);
    
    const cycle2Repairs = cycle2Events.filter(e => e.eventType === 'robot_repair').reduce((sum, e) => sum + (e.payload?.cost || 0), 0);
    const cycle2Operating = cycle2Events.filter(e => e.eventType === 'operating_costs').reduce((sum, e) => sum + (e.payload?.totalCost || 0), 0);
    const cycle2Credits = cycle2Events.filter(e => e.eventType === 'credit_change' && e.payload?.source === 'battle').reduce((sum, e) => sum + (e.payload?.amount || 0), 0);
    console.log(`Cycle 2 Credits: +₡${cycle2Credits.toLocaleString()}`);
    console.log(`Cycle 2 Repairs: -₡${cycle2Repairs.toLocaleString()}`);
    console.log(`Cycle 2 Operating: -₡${cycle2Operating.toLocaleString()}`);
    console.log(`After Cycle 2: ₡${(3000000 - totalPurchases - cycle1Repairs - cycle1Operating + cycle2Credits - cycle2Repairs - cycle2Operating).toLocaleString()}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSnapshots();
