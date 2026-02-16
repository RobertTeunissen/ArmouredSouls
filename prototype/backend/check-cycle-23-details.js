const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

BigInt.prototype.toJSON = function() { return this.toString(); };

async function checkCycle23Details() {
  try {
    console.log('Checking cycle 23 details for player1...\n');

    // Get player1 user
    const player1 = await prisma.user.findFirst({
      where: { username: 'player1' },
    });

    if (!player1) {
      console.log('player1 not found');
      return;
    }

    console.log(`Player1 ID: ${player1.id}`);
    console.log(`Current balance: ₡${player1.currency.toLocaleString()}\n`);

    // Get all audit events for player1 in cycle 23
    const events = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 23,
        userId: player1.id,
      },
      orderBy: { id: 'asc' },
    });

    console.log(`Total events for player1 in cycle 23: ${events.length}\n`);

    // Categorize events
    const eventsByType = {};
    events.forEach(e => {
      if (!eventsByType[e.eventType]) {
        eventsByType[e.eventType] = [];
      }
      eventsByType[e.eventType].push(e);
    });

    console.log('Events by type:');
    Object.keys(eventsByType).forEach(type => {
      console.log(`  ${type}: ${eventsByType[type].length}`);
    });

    // Check passive_income
    if (eventsByType['passive_income']) {
      console.log('\nPassive Income Events:');
      eventsByType['passive_income'].forEach(e => {
        const p = e.payload;
        console.log(`  Merchandising: ₡${p.merchandising}, Streaming: ₡${p.streaming}, Total: ₡${p.totalIncome || (p.merchandising + p.streaming)}`);
      });
    }

    // Check operating_costs
    if (eventsByType['operating_costs']) {
      console.log('\nOperating Costs Events:');
      eventsByType['operating_costs'].forEach(e => {
        const p = e.payload;
        console.log(`  Total: ₡${p.totalCost}`);
        if (p.facilities) {
          p.facilities.forEach(f => {
            console.log(`    - ${f.facilityType} (L${f.level}): ₡${f.cost}`);
          });
        }
      });
    }

    // Check credit_change events
    if (eventsByType['credit_change']) {
      console.log('\nCredit Change Events:');
      let totalCredits = 0;
      let totalDebits = 0;
      
      eventsByType['credit_change'].forEach(e => {
        const p = e.payload;
        const amount = p.amount || 0;
        const source = p.source || 'unknown';
        
        if (amount > 0) {
          totalCredits += amount;
          console.log(`  +₡${amount} (${source})`);
        } else {
          totalDebits += Math.abs(amount);
          console.log(`  -₡${Math.abs(amount)} (${source})`);
        }
      });
      
      console.log(`\n  Total credits: +₡${totalCredits}`);
      console.log(`  Total debits: -₡${totalDebits}`);
      console.log(`  Net from credit_change: ₡${totalCredits - totalDebits}`);
    }

    // Get snapshot data
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 23 },
    });

    if (snapshot && Array.isArray(snapshot.stableMetrics)) {
      const playerMetrics = snapshot.stableMetrics.find(m => m.userId === player1.id);
      
      if (playerMetrics) {
        console.log('\nSnapshot Metrics for player1:');
        console.log(`  Battles: ${playerMetrics.battlesParticipated}`);
        console.log(`  Credits earned: ₡${playerMetrics.totalCreditsEarned}`);
        console.log(`  Repair costs: ₡${playerMetrics.totalRepairCosts}`);
        console.log(`  Merchandising: ₡${playerMetrics.merchandisingIncome}`);
        console.log(`  Streaming: ₡${playerMetrics.streamingIncome}`);
        console.log(`  Operating costs: ₡${playerMetrics.operatingCosts}`);
        console.log(`  Net profit: ₡${playerMetrics.netProfit}`);
        
        // Calculate expected
        const expected = playerMetrics.totalCreditsEarned + 
                        playerMetrics.merchandisingIncome + 
                        playerMetrics.streamingIncome - 
                        playerMetrics.totalRepairCosts - 
                        playerMetrics.operatingCosts;
        console.log(`  Calculated net: ₡${expected}`);
      }
    }

    // Check battles for player1's robots in cycle 23
    const robots = await prisma.robot.findMany({
      where: { userId: player1.id },
      select: { id: true, name: true },
    });

    console.log(`\nPlayer1's robots: ${robots.map(r => r.name).join(', ')}`);

    // Get battles from audit log
    const battleEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 23,
        eventType: 'battle_complete',
      },
    });

    const robotIds = new Set(robots.map(r => r.id));
    const playerBattles = battleEvents.filter(e => {
      const p = e.payload;
      return robotIds.has(p.robot1Id) || robotIds.has(p.robot2Id);
    });

    console.log(`\nBattles involving player1's robots: ${playerBattles.length}`);
    
    let totalBattleRewards = 0;
    let totalRepairCosts = 0;
    
    playerBattles.forEach(e => {
      const p = e.payload;
      const isRobot1 = robotIds.has(p.robot1Id);
      const isRobot2 = robotIds.has(p.robot2Id);
      
      if (isRobot1) {
        const reward = p.winnerId === p.robot1Id ? (p.winnerReward || 0) : (p.loserReward || 0);
        const repair = p.robot1RepairCost || 0;
        totalBattleRewards += reward;
        totalRepairCosts += repair;
      }
      
      if (isRobot2) {
        const reward = p.winnerId === p.robot2Id ? (p.winnerReward || 0) : (p.loserReward || 0);
        const repair = p.robot2RepairCost || 0;
        totalBattleRewards += reward;
        totalRepairCosts += repair;
      }
    });

    console.log(`Total battle rewards: ₡${totalBattleRewards}`);
    console.log(`Total repair costs: ₡${totalRepairCosts}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCycle23Details();
