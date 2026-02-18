import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const BANKRUPTCY_RISK_THRESHOLD = 10000;

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'player1' },
    select: { id: true, currency: true, username: true }
  });
  
  console.log('User:', user);
  
  const financialEvents = await prisma.auditLog.findMany({
    where: {
      userId: user.id,
      eventType: {
        in: ['credit_change', 'operating_costs', 'passive_income', 'robot_repair'],
      },
      cycleNumber: { lte: 3 },
    },
    select: {
      cycleNumber: true,
      eventType: true,
      payload: true,
      sequenceNumber: true,
    },
    orderBy: [
      { cycleNumber: 'desc' },
      { sequenceNumber: 'desc' },
    ],
  });
  
  console.log(`\nFound ${financialEvents.length} financial events`);
  
  const cycleMap = new Map();
  
  for (const event of financialEvents) {
    const cycle = event.cycleNumber;
    if (!cycleMap.has(cycle)) {
      cycleMap.set(cycle, { costs: 0, income: 0, repairs: 0 });
    }
    
    const cycleData = cycleMap.get(cycle);
    
    if (event.eventType === 'operating_costs') {
      cycleData.costs += event.payload.totalCost || 0;
    } else if (event.eventType === 'passive_income') {
      cycleData.income += event.payload.totalIncome || 0;
    } else if (event.eventType === 'robot_repair') {
      cycleData.repairs += event.payload.cost || 0;
    } else if (event.eventType === 'credit_change') {
      const amount = event.payload.amount || 0;
      if (amount > 0) {
        cycleData.income += amount;
      } else {
        cycleData.costs += Math.abs(amount);
      }
    }
  }
  
  console.log('\nCycle data:');
  for (const [cycle, data] of cycleMap.entries()) {
    console.log(`Cycle ${cycle}:`, data);
    console.log(`  Total costs: ${data.costs + data.repairs}`);
  }
  
  // Calculate balances working backwards
  const cycles = Array.from(cycleMap.keys()).sort((a, b) => b - a);
  let runningBalance = user.currency;
  
  console.log('\nBalance history (working backwards from current):');
  console.log(`Current balance: ${runningBalance}`);
  
  for (const cycle of cycles) {
    const data = cycleMap.get(cycle);
    const totalCosts = data.costs + data.repairs;
    const netChange = data.income - totalCosts;
    
    console.log(`\nCycle ${cycle}:`);
    console.log(`  Balance at end: ${runningBalance}`);
    console.log(`  Income: ${data.income}`);
    console.log(`  Costs: ${totalCosts} (operating: ${data.costs}, repairs: ${data.repairs})`);
    console.log(`  Net change: ${netChange}`);
    
    runningBalance -= netChange;
    console.log(`  Balance at start: ${runningBalance}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
