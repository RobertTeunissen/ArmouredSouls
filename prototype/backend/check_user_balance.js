const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserBalance() {
  try {
    // Get player1 (userId 2)
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: {
        id: true,
        username: true,
        currency: true,
      },
    });

    console.log('\n=== User Balance ===');
    console.log(`User: ${user.username} (ID: ${user.id})`);
    console.log(`Current Balance: ₡${Number(user.currency).toLocaleString()}`);

    // Get all audit log events for this user
    const auditEvents = await prisma.auditLog.findMany({
      where: {
        userId: 2,
        eventType: {
          in: ['credit_change', 'robot_repair', 'operating_costs', 'passive_income', 
               'weapon_purchase', 'facility_purchase', 'facility_upgrade', 'attribute_upgrade'],
        },
      },
      orderBy: [
        { cycleNumber: 'asc' },
        { sequenceNumber: 'asc' },
      ],
    });

    console.log('\n=== Audit Log Events ===');
    let runningBalance = 3000000; // Starting balance
    
    const byCycle = {};
    
    auditEvents.forEach(event => {
      const cycle = event.cycleNumber;
      if (!byCycle[cycle]) {
        byCycle[cycle] = {
          income: 0,
          expenses: 0,
          purchases: 0,
          events: [],
        };
      }
      
      const payload = event.payload;
      let amount = 0;
      let type = '';
      
      switch (event.eventType) {
        case 'credit_change':
          amount = Number(payload.amount || 0);
          type = payload.source === 'battle' ? 'Battle Credits' : 'Other';
          if (amount > 0) {
            byCycle[cycle].income += amount;
          } else {
            byCycle[cycle].expenses += Math.abs(amount);
          }
          break;
        case 'robot_repair':
          amount = -Number(payload.cost || 0);
          type = 'Repair';
          byCycle[cycle].expenses += Math.abs(amount);
          break;
        case 'operating_costs':
          amount = -Number(payload.totalCost || 0);
          type = 'Operating Costs';
          byCycle[cycle].expenses += Math.abs(amount);
          break;
        case 'passive_income':
          amount = Number(payload.merchandising || 0) + Number(payload.streaming || 0);
          type = 'Passive Income';
          byCycle[cycle].income += amount;
          break;
        case 'weapon_purchase':
        case 'facility_purchase':
        case 'facility_upgrade':
        case 'attribute_upgrade':
          amount = -Number(payload.cost || 0);
          type = event.eventType.replace('_', ' ');
          byCycle[cycle].purchases += Math.abs(amount);
          break;
      }
      
      runningBalance += amount;
      byCycle[cycle].events.push({
        type,
        amount,
        balance: runningBalance,
      });
    });

    console.log('\n=== By Cycle ===');
    Object.keys(byCycle).sort((a, b) => Number(a) - Number(b)).forEach(cycle => {
      const data = byCycle[cycle];
      console.log(`\nCycle ${cycle}:`);
      console.log(`  Income: ₡${data.income.toLocaleString()}`);
      console.log(`  Expenses: ₡${data.expenses.toLocaleString()}`);
      console.log(`  Purchases: ₡${data.purchases.toLocaleString()}`);
      console.log(`  Net: ₡${(data.income - data.expenses - data.purchases).toLocaleString()}`);
      console.log(`  Events:`);
      data.events.forEach(e => {
        console.log(`    ${e.type}: ${e.amount >= 0 ? '+' : ''}₡${e.amount.toLocaleString()} → Balance: ₡${e.balance.toLocaleString()}`);
      });
    });

    console.log(`\n=== Final Calculated Balance: ₡${runningBalance.toLocaleString()} ===`);
    console.log(`=== Actual User Balance: ₡${Number(user.currency).toLocaleString()} ===`);
    console.log(`=== Difference: ₡${(Number(user.currency) - runningBalance).toLocaleString()} ===`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserBalance();
