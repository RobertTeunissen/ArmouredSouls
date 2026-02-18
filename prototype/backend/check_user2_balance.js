/**
 * Check User 2's balance calculation across cycles
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBalance() {
  try {
    console.log('\n=== User 2 Balance Calculation ===\n');

    // Get user's current balance
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: { currency: true, username: true },
    });

    console.log(`User: ${user.username}`);
    console.log(`Current Balance: ₡${Number(user.currency).toLocaleString()}\n`);

    // Starting balance
    let balance = 3000000;
    console.log(`Starting Balance: ₡${balance.toLocaleString()}`);

    // Cycle 0 - Purchases before first cycle
    const cycle0Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 0,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`\n--- Cycle 0 (Pre-cycle purchases) ---`);
    console.log(`Total events: ${cycle0Events.length}`);

    let cycle0Purchases = 0;
    cycle0Events.forEach(event => {
      if (event.eventType === 'weapon_purchase' || 
          event.eventType === 'facility_purchase' || 
          event.eventType === 'facility_upgrade' || 
          event.eventType === 'attribute_upgrade') {
        const cost = event.payload?.cost || 0;
        cycle0Purchases += cost;
        console.log(`  ${event.eventType}: -₡${cost.toLocaleString()}`);
      } else if (event.eventType === 'credit_change') {
        const amount = event.payload?.amount || 0;
        if (amount < 0) {
          cycle0Purchases += Math.abs(amount);
          console.log(`  ${event.eventType} (robot purchase): -₡${Math.abs(amount).toLocaleString()}`);
        }
      }
    });

    balance -= cycle0Purchases;
    console.log(`Total Cycle 0 Purchases: -₡${cycle0Purchases.toLocaleString()}`);
    console.log(`Balance after Cycle 0: ₡${balance.toLocaleString()}`);

    // Cycle 1
    const cycle1Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 1,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`\n--- Cycle 1 ---`);
    console.log(`Total events: ${cycle1Events.length}`);

    let cycle1Credits = 0;
    let cycle1Repairs = 0;
    let cycle1Operating = 0;

    cycle1Events.forEach(event => {
      if (event.eventType === 'credit_change' && event.payload?.source === 'battle') {
        const amount = event.payload?.amount || 0;
        cycle1Credits += amount;
        console.log(`  Battle credits: +₡${amount.toLocaleString()}`);
      } else if (event.eventType === 'robot_repair') {
        const cost = event.payload?.cost || 0;
        cycle1Repairs += cost;
        console.log(`  Repair: -₡${cost.toLocaleString()}`);
      } else if (event.eventType === 'operating_costs') {
        const cost = event.payload?.totalCost || 0;
        cycle1Operating += cost;
        console.log(`  Operating costs: -₡${cost.toLocaleString()}`);
      }
    });

    balance += cycle1Credits - cycle1Repairs - cycle1Operating;
    console.log(`Total Cycle 1 Credits: +₡${cycle1Credits.toLocaleString()}`);
    console.log(`Total Cycle 1 Repairs: -₡${cycle1Repairs.toLocaleString()}`);
    console.log(`Total Cycle 1 Operating: -₡${cycle1Operating.toLocaleString()}`);
    console.log(`Balance after Cycle 1: ₡${balance.toLocaleString()}`);

    // Cycle 2
    const cycle2Events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        userId: 2,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`\n--- Cycle 2 ---`);
    console.log(`Total events: ${cycle2Events.length}`);

    let cycle2Credits = 0;
    let cycle2Repairs = 0;
    let cycle2Operating = 0;

    cycle2Events.forEach(event => {
      if (event.eventType === 'credit_change' && event.payload?.source === 'battle') {
        const amount = event.payload?.amount || 0;
        cycle2Credits += amount;
        console.log(`  Battle credits: +₡${amount.toLocaleString()}`);
      } else if (event.eventType === 'robot_repair') {
        const cost = event.payload?.cost || 0;
        cycle2Repairs += cost;
        console.log(`  Repair: -₡${cost.toLocaleString()}`);
      } else if (event.eventType === 'operating_costs') {
        const cost = event.payload?.totalCost || 0;
        cycle2Operating += cost;
        console.log(`  Operating costs: -₡${cost.toLocaleString()}`);
      }
    });

    balance += cycle2Credits - cycle2Repairs - cycle2Operating;
    console.log(`Total Cycle 2 Credits: +₡${cycle2Credits.toLocaleString()}`);
    console.log(`Total Cycle 2 Repairs: -₡${cycle2Repairs.toLocaleString()}`);
    console.log(`Total Cycle 2 Operating: -₡${cycle2Operating.toLocaleString()}`);
    console.log(`Balance after Cycle 2: ₡${balance.toLocaleString()}`);

    console.log(`\n=== Summary ===`);
    console.log(`Expected Balance: ₡${balance.toLocaleString()}`);
    console.log(`Actual Balance: ₡${Number(user.currency).toLocaleString()}`);
    console.log(`Difference: ₡${(Number(user.currency) - balance).toLocaleString()}`);

    // Check all credit_change events for user 2
    console.log(`\n=== All credit_change events for User 2 ===`);
    const allCreditChanges = await prisma.auditLog.findMany({
      where: {
        userId: 2,
        eventType: 'credit_change',
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
    });

    console.log(`Total credit_change events: ${allCreditChanges.length}\n`);
    allCreditChanges.forEach(event => {
      const amount = event.payload?.amount || 0;
      const source = event.payload?.source || 'unknown';
      const reason = event.payload?.reason || '';
      console.log(`  Cycle ${event.cycleNumber}: ${amount >= 0 ? '+' : ''}₡${amount.toLocaleString()} | Source: ${source} | ${reason}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBalance();
